"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserLiveView } from "bedrock-agentcore/browser/live-view";

// Backs a real Bedrock AgentCore Browser Tool session: a genuine, isolated,
// AWS-managed Chromium instance the Lambda drives with real navigate() calls,
// streamed live into this page via NICE DCV. Not a replay -- every session
// here is a real browser doing real work at the moment you click.
const LAMBDA_URL = "https://zdkqjzidcei6rqcy5a43ahxtrm0gxauh.lambda-url.us-east-1.on.aws/";
const REMOTE_WIDTH = 1280;
const REMOTE_HEIGHT = 800;
const AUTO_STOP_MS = 90_000;

type Phase = "idle" | "starting" | "connecting" | "searching" | "done" | "error";

async function callLambda(body: Record<string, unknown>) {
  const resp = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export default function LiveVerification({ mcNumber, carrierName }: { mcNumber: string; carrierName: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const autoStopRef = useRef<number | null>(null);

  const query = `MC-${mcNumber} "${carrierName}" FMCSA carrier verification`;

  async function stopSession() {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setLiveViewUrl(null);
    setPhase("idle");
    if (id) {
      await callLambda({ action: "stop", sessionId: id }).catch(() => {});
    }
  }

  useEffect(() => {
    return () => {
      // Don't leave a paid session running if the broker navigates away mid-flow.
      if (sessionIdRef.current) {
        callLambda({ action: "stop", sessionId: sessionIdRef.current }).catch(() => {});
      }
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    };
  }, []);

  async function run() {
    setErrorMsg(null);
    setPhase("starting");
    const start = await callLambda({ action: "start" });
    if (start.error) {
      setPhase("error");
      setErrorMsg(
        start.error.includes("TooManyRequests") || start.error.includes("Throttl")
          ? "Live verification is at capacity right now (only a couple of sessions run at once to control cost) — try again in a moment."
          : start.error
      );
      return;
    }
    sessionIdRef.current = start.sessionId;
    setLiveViewUrl(start.liveViewUrl);
    setPhase("connecting");

    autoStopRef.current = window.setTimeout(stopSession, AUTO_STOP_MS);

    // A single navigate() call per session is what's proven reliable --
    // two sequential navigate() calls (each its own Lambda invocation
    // re-attaching to the session) don't consistently land on the same tab
    // Playwright already opened, so this goes straight to the real search
    // rather than an intermediate "google.com" beat that risked stalling.
    await new Promise((r) => setTimeout(r, 2200));
    setPhase("searching");
    await callLambda({
      action: "navigate",
      sessionId: start.sessionId,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    });

    setPhase("done");
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200 flex-wrap">
        <div className="text-xs text-slate-500">
          {phase === "idle" && "A real, isolated cloud browser the agent controls directly — not a replay."}
          {phase === "starting" && "Starting a real Bedrock AgentCore browser session…"}
          {phase === "connecting" && "Live view connected — agent opening a browser…"}
          {phase === "searching" && `Agent searching: “${query}”`}
          {phase === "done" && "Search complete — review the live results, then decide below."}
          {phase === "error" && <span className="text-red-600">{errorMsg}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase === "idle" || phase === "error" ? (
            <button
              onClick={run}
              className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md"
            >
              🔴 Verify {carrierName} live
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="text-xs font-medium bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              Stop session
            </button>
          )}
        </div>
      </div>

      {liveViewUrl && (
        <div style={{ width: "100%", aspectRatio: `${REMOTE_WIDTH} / ${REMOTE_HEIGHT}`, background: "#111" }}>
          <BrowserLiveView signedUrl={liveViewUrl} remoteWidth={REMOTE_WIDTH} remoteHeight={REMOTE_HEIGHT} />
        </div>
      )}
    </div>
  );
}

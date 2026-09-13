"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrowserLiveView } from "bedrock-agentcore/browser/live-view";

// Backs a real Bedrock AgentCore Browser Tool session: a genuine, isolated,
// AWS-managed Chromium instance a Lambda drives with real navigate() calls,
// streamed live into this page via NICE DCV. You type the query -- this is
// not a fixed demo running the same script every time.
const LAMBDA_URL = "https://zdkqjzidcei6rqcy5a43ahxtrm0gxauh.lambda-url.us-east-1.on.aws/";
const REMOTE_WIDTH = 1280;
const REMOTE_HEIGHT = 800;
const AUTO_STOP_MS = 90_000;
const START_TIMEOUT_MS = 20_000;
const CONNECT_GRACE_MS = 9_000;

type Phase = "idle" | "starting" | "connecting" | "searching" | "done" | "error";

interface LogLine {
  t: string;
  text: string;
}

function timestamp() {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

async function callLambda(body: Record<string, unknown>, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Request failed (HTTP ${resp.status})`);
    }
    return await resp.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export default function LiveInvestigation() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  function pushLog(text: string) {
    setLog((prev) => [...prev, { t: timestamp(), text }]);
  }

  async function stopSession(silent = false) {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setLiveViewUrl(null);
    if (!silent) {
      setPhase("idle");
      pushLog("Session stopped.");
    }
    if (id) {
      await callLambda({ action: "stop", sessionId: id }, 10_000).catch(() => {});
    }
  }

  useEffect(() => {
    return () => {
      // Don't leave a paid session running if you navigate away mid-flow.
      if (sessionIdRef.current) {
        callLambda({ action: "stop", sessionId: sessionIdRef.current }, 10_000).catch(() => {});
      }
      if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    };
  }, []);

  async function run() {
    const trimmed = query.trim();
    if (!trimmed) return;

    const myRunId = ++runIdRef.current;
    const stillCurrent = () => runIdRef.current === myRunId;

    setLog([]);
    setPhase("starting");
    pushLog(`Requesting a real AWS browser session…`);

    try {
      const start = await callLambda({ action: "start" }, START_TIMEOUT_MS);
      if (!stillCurrent()) return;

      if (start.error) {
        const friendly = /Throttl|TooManyRequests|capacity/i.test(start.error)
          ? "Live verification is at capacity right now (only a couple of sessions run at once to control cost) — try again in a moment."
          : start.error;
        setPhase("error");
        pushLog(`Failed to start: ${friendly}`);
        return;
      }

      sessionIdRef.current = start.sessionId;
      setLiveViewUrl(start.liveViewUrl);
      setPhase("connecting");
      pushLog(`Session ${start.sessionId} started — connecting live view…`);

      autoStopRef.current = window.setTimeout(() => stopSession(), AUTO_STOP_MS);

      await new Promise((r) => setTimeout(r, CONNECT_GRACE_MS));
      if (!stillCurrent()) return;

      setPhase("searching");
      pushLog(`Agent searching: "${trimmed}"`);
      const nav = await callLambda(
        {
          action: "navigate",
          sessionId: start.sessionId,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`,
        },
        20_000
      );
      if (!stillCurrent()) return;

      if (nav.error) {
        setPhase("error");
        pushLog(`Navigation failed: ${nav.error}`);
        return;
      }

      pushLog("Search submitted — the live view above may take a moment to catch up.");
      // The API call confirming navigation succeeded doesn't mean the DCV
      // video stream has caught up to show it yet -- BrowserLiveView doesn't
      // expose a "frame received" callback to wait on, so this is a fixed
      // buffer, not a real completion signal.
      await new Promise((r) => setTimeout(r, 5000));
      if (!stillCurrent()) return;

      setPhase("done");
      pushLog("Should be showing live results above now — scroll up if not visible.");
    } catch (err) {
      if (!stillCurrent()) return;
      setPhase("error");
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Timed out waiting for AWS to respond. This can happen if your network blocks WebSocket connections to bedrock-agentcore.us-east-1.amazonaws.com — try again, or check your connection."
          : err instanceof Error
            ? err.message
            : "Unknown error";
      pushLog(`Error: ${message}`);
    }
  }

  // "done" still has a live (billable) session running until stopped or it
  // auto-expires -- keep showing "Stop session" rather than a fresh
  // "Investigate live" button that implies nothing is active anymore.
  const running = phase === "starting" || phase === "connecting" || phase === "searching" || phase === "done";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && run()}
          placeholder="Type any company, carrier, or MC number to investigate…"
          disabled={running}
          className="flex-1 min-w-[240px] text-sm border border-slate-300 rounded-md px-3 py-2 disabled:bg-slate-50"
        />
        {running ? (
          <button
            onClick={() => stopSession()}
            className="text-xs font-medium bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-md hover:bg-slate-50"
          >
            Stop session
          </button>
        ) : (
          <button
            onClick={run}
            disabled={!query.trim()}
            className="text-xs font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white px-4 py-2 rounded-md"
          >
            🔴 Investigate live
          </button>
        )}
      </div>

      {log.length > 0 && (
        <div className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mb-3 space-y-0.5 max-h-32 overflow-y-auto">
          {log.map((l, i) => (
            <div key={i} className="text-slate-600">
              <span className="text-slate-400">{l.t}</span> {l.text}
            </div>
          ))}
        </div>
      )}

      {liveViewUrl && (
        <div
          className="rounded-lg overflow-hidden border border-slate-200"
          style={{ width: "100%", aspectRatio: `${REMOTE_WIDTH} / ${REMOTE_HEIGHT}`, background: "#111" }}
        >
          <BrowserLiveView signedUrl={liveViewUrl} remoteWidth={REMOTE_WIDTH} remoteHeight={REMOTE_HEIGHT} />
        </div>
      )}

      {!liveViewUrl && phase === "idle" && (
        <p className="text-xs text-slate-400">
          This starts a real, isolated Amazon Bedrock AgentCore browser session — not a replay or a video. Whatever
          you type is what it actually searches for, live, streamed here as it happens.
        </p>
      )}
    </div>
  );
}

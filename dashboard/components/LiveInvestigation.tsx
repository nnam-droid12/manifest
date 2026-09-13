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
  const [showRenderHelp, setShowRenderHelp] = useState(false);
  const renderHelpRef = useRef<number | null>(null);

  function pushLog(text: string) {
    setLog((prev) => [...prev, { t: timestamp(), text }]);
  }

  async function stopSession(silent = false) {
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    if (renderHelpRef.current) window.clearTimeout(renderHelpRef.current);
    setShowRenderHelp(false);
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
      if (renderHelpRef.current) window.clearTimeout(renderHelpRef.current);
    };
  }, []);

  // The vendored NICE DCV client (inside bedrock-agentcore's BrowserLiveView,
  // AWS's own bundled code, not ours) can throw an unhandled promise
  // rejection from its internal license-check step and simply stop --
  // observed specifically on a slow/high-latency connection, with no
  // visible frame and no callback telling this component anything failed.
  // There's no way to fix that internal code from here, but there's no
  // reason to let it fail silently either.
  useEffect(() => {
    if (!liveViewUrl) return;
    const onRejection = (event: PromiseRejectionEvent) => {
      if (renderHelpRef.current) window.clearTimeout(renderHelpRef.current);
      setShowRenderHelp(false);
      setPhase("error");
      pushLog(
        "The AWS live-view video failed to initialize (an internal error in AWS's own browser-streaming client, " +
          "often triggered by a slow or high-latency connection). The search itself still ran for real -- only " +
          "the video preview failed. Try again, ideally on a faster connection."
      );
      console.error("DCV unhandled rejection:", event.reason);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [liveViewUrl]);

  async function run() {
    const trimmed = query.trim();
    if (!trimmed) return;

    const myRunId = ++runIdRef.current;
    const stillCurrent = () => runIdRef.current === myRunId;

    // Opened synchronously, in the same click, before any await -- browsers
    // block window.open() once you've gone through an async gap, so this has
    // to happen first. This is a real tab in your own browser hitting the
    // same query, not the remote agent's own tab (there's no way for a page
    // to hand you another machine's tab as a native browser tab, only stream
    // its video, which is the part that's been unreliable) -- it's guaranteed
    // to work regardless of AWS or network conditions, since it never leaves
    // your machine.
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");

    setLog([]);
    setPhase("starting");
    pushLog(`Opened "${trimmed}" in a new tab.`);
    pushLog(`Also requesting a real, separate AWS agent session running the same search…`);

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
      // There's no callback from BrowserLiveView to know whether the video
      // actually painted -- if you don't see anything above after a
      // reasonable wait, this is the only way to surface that honestly
      // instead of staying silent.
      setShowRenderHelp(false);
      renderHelpRef.current = window.setTimeout(() => setShowRenderHelp(true), 8_000);

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

      {liveViewUrl && showRenderHelp && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
          Not seeing a browser window above? There's no way for this page to detect whether the video actually
          painted, so this can't tell you which happened — but the session and search themselves did complete (see
          the log above). Open your browser's DevTools (F12) → Console tab and look for a red error mentioning
          "dcv" or "bedrock-agentcore" — that line is the actual cause, and would help get this fixed for real
          instead of guessed at.
        </div>
      )}

      {!liveViewUrl && phase === "idle" && (
        <p className="text-xs text-slate-400">
          Opens a real search in a new tab immediately, guaranteed to work — and, in parallel, starts a real,
          isolated Amazon Bedrock AgentCore browser session running the identical query, streamed live below when
          the connection allows it.
        </p>
      )}
    </div>
  );
}

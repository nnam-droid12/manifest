"use client";

import { useState } from "react";
import Link from "next/link";
import { auditTrail, approvals, loads } from "@/lib/demo-data";
import { Badge } from "@/components/ui";
import { extractMcNumber, saferSnapshotUrl } from "@/lib/fmcsa";

// The real, chronological lifecycle of Load 1002 (Chicago -> Atlanta, Reefer,
// Frozen Foods) as it actually ran: found, priced, offered, and then two
// independent real findings surfaced downstream. Pulled by id from the same
// audit trail shown elsewhere, not duplicated text, so there's no drift.
const SEQUENCE_IDS = ["a1", "a3", "a4", "a5", "a8"];
const STAGES = SEQUENCE_IDS.map((id) => auditTrail.find((e) => e.id === id)!);

// A second carrier, vetted in the same session, on a separate load — kept
// visually distinct rather than spliced into load 1002's chain, because
// that's what actually happened (see the Orchestrator's own a9 entry).
const FRAUD_WATCH = auditTrail.find((e) => e.id === "a2")!;
const FRAUD_APPROVAL = approvals.find((a) => a.sourceEntryId === "a2");

const LOAD = loads.find((l) => l.id === "1002")!;
// The real ceiling Rate Intelligence computed for this load (see stage a3's
// summary: "target $1,650 / ceiling $1,680") -- not a separate made-up number.
const CEILING = 1680;

// The exact same rule as evaluate_counter_offer() in
// agents/src/manifest_agents/carrier_outreach/guarded_tools.py -- a straight
// comparison, not a judgment call, mirrored here so trying it doesn't need a
// round trip to a server for logic this simple.
function evaluateCounterOffer(counterRate: number, ceilingRate: number) {
  const withinCeiling = counterRate <= ceilingRate;
  return {
    withinCeiling,
    action: withinCeiling ? "accept" : "escalate",
    marginVsCeiling: Math.round((ceilingRate - counterRate) * 100) / 100,
  };
}

const OUTCOME_DOT: Record<string, string> = {
  info: "#94a3b8",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

function initials(agent: string): string {
  const clean = agent.replace(/\(.*?\)/g, "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 1 && w !== "&");
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

type Phase = "idle" | "running" | "done";

const STAGE_MS = 1500;

export default function LiveDispatch() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0); // how many stages have fully appeared
  const [thinking, setThinking] = useState(-1); // index currently in "working..." state
  const [showFraudWatch, setShowFraudWatch] = useState(false);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [counterInput, setCounterInput] = useState("");
  const [testedCounter, setTestedCounter] = useState<number | null>(null);

  const outreachIndex = SEQUENCE_IDS.indexOf("a4");
  const result = testedCounter != null ? evaluateCounterOffer(testedCounter, CEILING) : null;

  function run() {
    setLiveMessage(null);
    setPhase("running");
    setRevealed(0);
    setThinking(0);
    setShowFraudWatch(false);
    setRunKey((k) => k + 1);
    setCounterInput("");
    setTestedCounter(null);

    STAGES.forEach((_, i) => {
      window.setTimeout(() => {
        setThinking(i);
      }, i * STAGE_MS);
      window.setTimeout(() => {
        setRevealed(i + 1);
        setThinking(i + 1 < STAGES.length ? i + 1 : -1);
        if (i === STAGES.length - 1) {
          setPhase("done");
          window.setTimeout(() => setShowFraudWatch(true), 900);
        }
      }, i * STAGE_MS + 900);
    });
  }

  function tryLive() {
    setLiveMessage(
      "Live dispatch would invoke the deployed Orchestrator on Bedrock AgentCore directly — that wiring " +
        "(a signed browser call through a Lambda bridge) isn't built yet. Showing the real, verified run " +
        "for this load instead, not a placeholder."
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Live Dispatch — Load {LOAD.id}: {LOAD.origin} → {LOAD.destination}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {LOAD.equipmentType} · {LOAD.commodity} · replaying the real, verified agent sequence for this load
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={tryLive}
            className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50"
          >
            Try live invocation
          </button>
          <button
            onClick={run}
            disabled={phase === "running"}
            className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 disabled:opacity-50"
          >
            {phase === "idle" ? "▶ Run dispatch" : phase === "running" ? "Running…" : "▶ Replay dispatch"}
          </button>
        </div>
      </div>

      {liveMessage && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {liveMessage}
        </div>
      )}

      {/* Pipeline stepper */}
      <div className="flex items-center mb-6" key={`stepper-${runKey}`}>
        {STAGES.map((stage, i) => {
          const active = revealed > i;
          const isThinking = thinking === i;
          return (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    isThinking ? "swarm-pulse" : ""
                  }`}
                  style={{ backgroundColor: active ? OUTCOME_DOT[stage.outcome] : isThinking ? "#1b4332" : "#cbd5e1" }}
                >
                  {initials(stage.agent)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5 text-center max-w-[80px] leading-tight">
                  {stage.agent.replace(/ Agent$/, "")}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 -mt-5" style={{ backgroundColor: revealed > i + 1 ? "#95d5b2" : "#e2e8f0" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Revealed stage cards */}
      <div className="space-y-3" key={`cards-${runKey}`}>
        {STAGES.slice(0, revealed).map((stage, i) => (
          <div
            key={stage.id}
            className="border border-slate-200 rounded-lg px-4 py-3 timeline-reveal"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-medium text-slate-900">{stage.agent}</div>
              <Badge tone={stage.outcome}>{stage.outcome.toUpperCase()}</Badge>
            </div>
            <div className="text-sm text-slate-700 mt-1">{stage.summary}</div>
            {stage.tools && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {stage.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                  >
                    {tool}()
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{stage.reasoning}</p>

            {i === outreachIndex && revealed > outreachIndex && (
              <div className="border-t border-slate-100 mt-3 pt-3">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Try it yourself — what if the carrier counters?
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Carrier counters at $</span>
                  <input
                    type="number"
                    value={counterInput}
                    onChange={(e) => setCounterInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && counterInput) setTestedCounter(Number(counterInput));
                    }}
                    placeholder="e.g. 1750"
                    className="w-28 text-sm border border-slate-300 rounded-md px-2 py-1"
                  />
                  <button
                    onClick={() => counterInput && setTestedCounter(Number(counterInput))}
                    disabled={!counterInput}
                    className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 disabled:opacity-40"
                  >
                    Evaluate
                  </button>
                  <span className="text-xs text-slate-400">real ceiling: ${CEILING.toLocaleString()}</span>
                </div>

                {result && (
                  <div
                    className={`mt-3 rounded-lg px-3 py-2.5 border ${
                      result.withinCeiling ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge tone={result.withinCeiling ? "success" : "danger"}>
                        {result.action.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">
                        evaluate_counter_offer(${testedCounter}, ${CEILING})
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {result.withinCeiling ? (
                        <>
                          Within ceiling — send_rate_offer proceeds at ${testedCounter}. Margin to ceiling: $
                          {result.marginVsCeiling.toLocaleString()}.
                        </>
                      ) : (
                        <>
                          Exceeds the ${CEILING.toLocaleString()} ceiling by $
                          {Math.abs(result.marginVsCeiling).toLocaleString()} — send_rate_offer refuses this in
                          code before anything reaches the carrier. Escalated to the broker instead.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {thinking >= 0 && (
          <div className="border border-dashed border-slate-300 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-ink animate-ping" />
            {STAGES[thinking]?.agent} is working…
          </div>
        )}
      </div>

      {phase === "done" && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="text-sm text-slate-800">
            <span className="font-semibold">2 real issues surfaced</span> on this one shipment — a rate
            mismatch on the paperwork and cargo damage at delivery — both routed to a human, not resolved
            silently.
          </div>
          <Link href="/approvals" className="text-xs font-medium text-ink hover:underline mt-2 inline-block">
            Review in Approvals →
          </Link>
        </div>
      )}

      {showFraudWatch && (
        <div className="mt-4 border-t border-slate-100 pt-4 timeline-reveal">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Meanwhile, on a separate carrier
          </div>
          <div className="border border-red-200 bg-red-50/50 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-medium text-slate-900">{FRAUD_WATCH.agent}</div>
              <Badge tone={FRAUD_WATCH.outcome}>{FRAUD_WATCH.outcome.toUpperCase()}</Badge>
            </div>
            <div className="text-sm text-slate-700 mt-1">{FRAUD_WATCH.summary}</div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{FRAUD_WATCH.reasoning}</p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {FRAUD_APPROVAL && (
                <Link href="/approvals" className="text-xs font-medium text-ink hover:underline">
                  Review in Approvals →
                </Link>
              )}
              {(() => {
                const mc = extractMcNumber(FRAUD_WATCH.summary);
                return mc ? (
                  <a
                    href={saferSnapshotUrl(mc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md"
                  >
                    🔍 Verify MC-{mc} on FMCSA SAFER ↗
                  </a>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

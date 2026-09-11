"use client";

import { useState } from "react";
import { auditTrail, type AuditEntry } from "@/lib/demo-data";
import { Badge } from "@/components/ui";

const ORCHESTRATOR_MATCH = [
  "Orchestrator Agent",
  "Orchestrator (Bedrock AgentCore deployment)",
  "Orchestrator (AgentCore Memory)",
  "Orchestrator (cross-runtime delegation)",
];

function initials(agent: string): string {
  const clean = agent.replace(/\(.*?\)/g, "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 1 && w !== "&");
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const DOT_COLOR: Record<AuditEntry["outcome"], string> = {
  info: "#94a3b8",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

function EntryCard({ entry, index, replayKey }: { entry: AuditEntry; index: number; replayKey: number }) {
  const [expanded, setExpanded] = useState(false);
  const isOrchestrator = ORCHESTRATOR_MATCH.includes(entry.agent);

  return (
    <div
      key={replayKey}
      className="relative pl-14 pb-7 timeline-reveal"
      style={{ animationDelay: `${Math.min(index * 90, 900)}ms` }}
    >
      {/* connecting line */}
      <div className="absolute left-[22px] top-9 bottom-0 w-px bg-slate-200" />
      {/* dot / avatar */}
      <div
        className="absolute left-0 top-0 w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
        style={{ backgroundColor: isOrchestrator ? "#0b2e4f" : DOT_COLOR[entry.outcome] }}
      >
        {initials(entry.agent)}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">{entry.agent}</span>
              {entry.loadId && <span className="text-xs text-slate-400">Load {entry.loadId}</span>}
            </div>
            <div className="text-sm text-slate-700 mt-1">{entry.summary}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge tone={entry.outcome}>{entry.outcome.toUpperCase()}</Badge>
            <span className="text-xs text-slate-400">
              {new Date(entry.timestamp).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {entry.tools && entry.tools.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            {entry.tools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1 text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {tool}
                <span className="text-slate-400">()</span>
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-ink mt-3 hover:underline"
        >
          {expanded ? "Hide reasoning ▲" : "Show full reasoning ▼"}
        </button>

        {expanded && (
          <p className="text-sm text-slate-600 mt-2 leading-relaxed border-t border-slate-100 pt-3">
            {entry.reasoning}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Timeline({ filterAgent }: { filterAgent: string | null }) {
  const [replayKey, setReplayKey] = useState(0);

  const entries =
    filterAgent === "__orchestrator__"
      ? auditTrail.filter((e) => ORCHESTRATOR_MATCH.includes(e.agent))
      : filterAgent
        ? auditTrail.filter((e) => e.agent === filterAgent)
        : auditTrail;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">
          {filterAgent ? (
            <>
              Showing <span className="font-medium text-slate-700">{entries.length}</span> run
              {entries.length === 1 ? "" : "s"} for this agent
            </>
          ) : (
            <>
              <span className="font-medium text-slate-700">{entries.length}</span> total runs across the swarm
            </>
          )}
        </div>
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          className="text-xs font-medium bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-50"
        >
          ▶ Replay timeline
        </button>
      </div>
      <div>
        {entries.map((entry, i) => (
          <EntryCard key={`${entry.id}-${replayKey}`} entry={entry} index={i} replayKey={replayKey} />
        ))}
      </div>
    </div>
  );
}

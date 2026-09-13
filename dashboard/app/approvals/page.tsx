"use client";

import { useState } from "react";
import Link from "next/link";
import { approvals as initialApprovals, auditTrail, type Approval } from "@/lib/demo-data";
import { Badge, PageHeader } from "@/components/ui";
import { extractMcNumber, extractCarrierName, saferSnapshotUrl } from "@/lib/fmcsa";

type Decision = "approved" | "rejected" | null;

function initials(agent: string): string {
  const clean = agent.replace(/\(.*?\)/g, "").trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 1 && w !== "&");
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const RISK_DOT: Record<string, string> = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444" };

export default function ApprovalsPage() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [showEvidence, setShowEvidence] = useState<Record<string, boolean>>({});

  const decide = (id: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Agents propose, you decide. Each item below is a real agent's case — its tool calls and reasoning, not just a claim — and nothing reaches a carrier or a customer until you act on it."
      />

      <div className="space-y-5">
        {initialApprovals.map((item: Approval) => {
          const decision = decisions[item.id];
          const source = auditTrail.find((e) => e.id === item.sourceEntryId);
          const evidenceOpen = showEvidence[item.id];
          const mcNumber = extractMcNumber(item.title);
          const carrierName = extractCarrierName(item.title);

          return (
            <div key={item.id} className="relative">
              <div
                className="absolute -inset-px rounded-xl pointer-events-none"
                style={{
                  boxShadow: decision ? "none" : `0 0 0 1px ${RISK_DOT[item.risk]}22`,
                }}
              />
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-start gap-4 px-5 py-4">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 swarm-pulse-soft"
                    style={{ backgroundColor: RISK_DOT[item.risk] }}
                  >
                    {initials(item.agent)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge tone={item.risk}>{item.risk} RISK</Badge>
                      <span className="text-xs text-slate-400">flagged by {item.agent}</span>
                      {item.relatedLoadId && (
                        <span className="text-xs text-slate-400">· Load {item.relatedLoadId}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.detail}</p>

                    {source?.tools && source.tools.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-3">
                        {source.tools.map((tool) => (
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

                    {source && (
                      <button
                        onClick={() => setShowEvidence((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="text-xs font-medium text-ink mt-3 hover:underline"
                      >
                        {evidenceOpen ? "Hide agent's full reasoning ▲" : "See agent's full reasoning ▼"}
                      </button>
                    )}
                    {evidenceOpen && source && (
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed border-t border-slate-100 pt-3">
                        {source.reasoning}
                      </p>
                    )}

                    {mcNumber && carrierName && (
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <Link
                          href={`/investigate?q=${encodeURIComponent(`MC-${mcNumber} "${carrierName}"`)}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md"
                        >
                          🔴 Investigate {carrierName} live →
                        </Link>
                        <a
                          href={saferSnapshotUrl(mcNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-400 hover:text-slate-600"
                        >
                          or open FMCSA SAFER yourself ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  {decision === null || decision === undefined ? (
                    <>
                      <button
                        onClick={() => decide(item.id, "approved")}
                        className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(item.id, "rejected")}
                        className="text-xs font-medium bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50"
                      >
                        Reject
                      </button>
                      <span className="text-xs text-slate-400 ml-2">
                        Autonomous action is blocked until you decide
                      </span>
                    </>
                  ) : (
                    <Badge tone={decision === "approved" ? "success" : "danger"}>
                      {decision === "approved" ? "Approved by you" : "Rejected by you"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {initialApprovals.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-sm text-slate-400">
            Nothing waiting on you.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { approvals as initialApprovals, type Approval } from "@/lib/demo-data";
import { Card, Badge, PageHeader } from "@/components/ui";

type Decision = "approved" | "rejected" | null;

export default function ApprovalsPage() {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const decide = (id: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Agents propose, you decide. Nothing below reaches a carrier or a customer until you act on it."
      />

      <div className="space-y-4">
        {initialApprovals.map((item: Approval) => {
          const decision = decisions[item.id];
          return (
            <Card key={item.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={item.risk}>{item.risk} RISK</Badge>
                    <span className="text-xs text-slate-400">{item.agent}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.detail}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
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
                  </>
                ) : (
                  <Badge tone={decision === "approved" ? "success" : "danger"}>
                    {decision === "approved" ? "Approved by you" : "Rejected by you"}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}

        {initialApprovals.length === 0 && (
          <Card className="px-5 py-8 text-center text-sm text-slate-400">Nothing waiting on you.</Card>
        )}
      </div>
    </div>
  );
}

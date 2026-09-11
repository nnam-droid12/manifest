"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import SwarmMap from "@/components/SwarmMap";
import Timeline from "@/components/Timeline";

export default function AuditPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Every agent action, with its full reasoning — so you can see exactly why the system did what it did, not just that it did something. Click a node in the swarm to filter."
      />

      <div className="mb-8">
        <SwarmMap selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
      </div>

      {selectedAgent && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtered to:</span>
          <span className="text-xs font-medium bg-ink text-white px-2.5 py-1 rounded-full">
            {selectedAgent === "__orchestrator__" ? "Orchestrator (all variants)" : selectedAgent}
          </span>
          <button
            onClick={() => setSelectedAgent(null)}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            clear
          </button>
        </div>
      )}

      <Timeline filterAgent={selectedAgent} />
    </div>
  );
}

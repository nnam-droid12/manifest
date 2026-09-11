"use client";

import { useMemo, useState } from "react";
import { auditTrail } from "@/lib/demo-data";

interface SwarmNode {
  id: string;
  label: string;
  matchAgents: string[];
  runtime: "agentcore" | "local";
}

const NODES: SwarmNode[] = [
  { id: "load-matching", label: "Load-Matching", matchAgents: ["Load-Matching Agent"], runtime: "local" },
  {
    id: "carrier-vetting",
    label: "Carrier Vetting",
    matchAgents: ["Carrier Vetting & Fraud Detection Agent"],
    runtime: "agentcore",
  },
  { id: "rate-intel", label: "Rate Intelligence", matchAgents: ["Rate Intelligence Agent"], runtime: "local" },
  { id: "outreach", label: "Carrier Outreach", matchAgents: ["Carrier Outreach Agent"], runtime: "local" },
  { id: "doc-extraction", label: "Document Extraction", matchAgents: ["Document Extraction Agent"], runtime: "local" },
  { id: "cargo", label: "Cargo Condition", matchAgents: ["Cargo Condition Agent"], runtime: "local" },
  { id: "track-trace", label: "Track-and-Trace", matchAgents: ["Track-and-Trace Agent"], runtime: "local" },
  { id: "customer-update", label: "Customer Update", matchAgents: ["Customer Update Agent"], runtime: "local" },
  { id: "voice", label: "Voice Check-In", matchAgents: ["Voice Check-In Agent"], runtime: "local" },
  { id: "playbook", label: "Playbook & Lane-History", matchAgents: ["Playbook & Lane-History Agent"], runtime: "local" },
];

const ORCHESTRATOR_MATCH = [
  "Orchestrator Agent",
  "Orchestrator (Bedrock AgentCore deployment)",
  "Orchestrator (AgentCore Memory)",
  "Orchestrator (cross-runtime delegation)",
  "Orchestrator (multi-tenant AgentCore Memory)",
];

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function SwarmMap({
  selectedAgent,
  onSelectAgent,
}: {
  selectedAgent: string | null;
  onSelectAgent: (agent: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const nodeStats = useMemo(() => {
    return NODES.map((node) => {
      const entries = auditTrail.filter((e) => node.matchAgents.includes(e.agent));
      return { ...node, count: entries.length, hasFinding: entries.some((e) => e.outcome === "danger" || e.outcome === "warning") };
    });
  }, []);

  const orchestratorCount = useMemo(
    () => auditTrail.filter((e) => ORCHESTRATOR_MATCH.includes(e.agent)).length,
    []
  );

  const size = 620;
  const center = size / 2;
  const ringR = 240;
  const nodeR = 46;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-900">Agent Swarm — live topology</h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-slate-300" /> local process
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-indigo-400 swarm-dash" /> AgentCore Runtime (cross-network call)
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-h-[560px] mx-auto block">
        {/* edges */}
        {nodeStats.map((node, i) => {
          const angle = (360 / nodeStats.length) * i - 90;
          const p = polarPoint(center, center, ringR, angle);
          const active = node.count > 0;
          const isAgentCore = node.runtime === "agentcore";
          return (
            <line
              key={`edge-${node.id}`}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke={isAgentCore ? "#818cf8" : active ? "#cbd5e1" : "#e2e8f0"}
              strokeWidth={isAgentCore ? 2 : 1.5}
              strokeDasharray={isAgentCore ? "5 4" : undefined}
              className={isAgentCore ? "swarm-dash" : undefined}
            />
          );
        })}

        {/* center: orchestrator */}
        <g
          onMouseEnter={() => setHovered("__orchestrator__")}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelectAgent(selectedAgent === "__orchestrator__" ? null : "__orchestrator__")}
          className="cursor-pointer"
        >
          <circle
            cx={center}
            cy={center}
            r={58}
            fill="#0b2e4f"
            className={orchestratorCount > 0 ? "swarm-pulse" : undefined}
          />
          <circle
            cx={center}
            cy={center}
            r={58}
            fill="none"
            stroke={selectedAgent === "__orchestrator__" ? "#f59e0b" : "transparent"}
            strokeWidth={3}
          />
          <text x={center} y={center - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
            Orchestrator
          </text>
          <text x={center} y={center + 14} textAnchor="middle" fontSize="10" fill="#93c5fd">
            {orchestratorCount} runs
          </text>
        </g>

        {/* agent nodes */}
        {nodeStats.map((node, i) => {
          const angle = (360 / nodeStats.length) * i - 90;
          const p = polarPoint(center, center, ringR, angle);
          const active = node.count > 0;
          const isSelected = selectedAgent === node.matchAgents[0];
          const isHovered = hovered === node.id;
          return (
            <g
              key={node.id}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectAgent(isSelected ? null : node.matchAgents[0])}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR}
                fill={node.hasFinding ? "#fef3c7" : "#eef2ff"}
                stroke={isSelected ? "#f59e0b" : isHovered ? "#818cf8" : active ? "#c7d2fe" : "#e2e8f0"}
                strokeWidth={isSelected ? 3 : 2}
                className={active ? "swarm-pulse-soft" : undefined}
              />
              {node.runtime === "agentcore" && (
                <circle cx={p.x + nodeR - 10} cy={p.y - nodeR + 10} r={6} fill="#6366f1" />
              )}
              <text
                x={p.x}
                y={p.y - 4}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="600"
                fill="#1e293b"
              >
                {node.label.split(" ").slice(0, 2).join(" ")}
              </text>
              {node.label.split(" ").length > 2 && (
                <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#1e293b">
                  {node.label.split(" ").slice(2).join(" ")}
                </text>
              )}
              <text x={p.x} y={p.y + (node.label.split(" ").length > 2 ? 23 : 13)} textAnchor="middle" fontSize="9.5" fill="#64748b">
                {node.count} {node.count === 1 ? "run" : "runs"}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-[11px] text-slate-400 text-center mt-1">
        Click a node to filter the timeline below. The indigo dashed spoke (Carrier Vetting) is a genuine
        cross-runtime call — a separate deployed AgentCore Runtime, not an in-process tool.
      </p>
    </div>
  );
}

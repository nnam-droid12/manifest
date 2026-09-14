import { loads, stats, approvals, auditTrail } from "@/lib/demo-data";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  Available: "info",
  "Offer Sent": "success",
  "Awaiting Review": "warning",
  Booked: "success",
};

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

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="What the agent swarm is working on right now, and what needs your attention."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Loads" value={String(stats.activeLoads)} />
        <StatCard label="Pending Approvals" value={String(stats.pendingApprovals)} sub="Needs your review" />
        <StatCard label="Fraud Flags Caught" value={String(stats.fraudFlagsCaught)} sub="Last 90 days" />
        <StatCard label="Avg. Margin" value={`${stats.avgMarginPct}%`} sub="Across active lanes" />
      </div>

      {approvals.length > 0 && (
        <Card className="mb-8 px-5 py-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-amber-900">
                {approvals.length} item{approvals.length > 1 ? "s" : ""} waiting on your review
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Agents don&apos;t proceed autonomously on these — nothing happens until you decide.
              </div>
            </div>
            <Link
              href="/approvals"
              className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90"
            >
              Review now
            </Link>
          </div>
        </Card>
      )}

      <Card className="mb-8">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live Agent Activity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Most recent real agent runs across the swarm</p>
          </div>
          <Link href="/audit" className="text-xs font-medium text-ink hover:underline">
            View full swarm & audit trail →
          </Link>
        </div>
        <div className="px-5 py-4 space-y-3">
          {auditTrail
            .slice()
            .reverse()
            .slice(0, 5)
            .map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: OUTCOME_DOT[entry.outcome] }}
                >
                  {initials(entry.agent)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 truncate">
                    <span className="font-medium">{entry.agent}</span>{" "}
                    <span className="text-slate-500">— {entry.summary}</span>
                  </div>
                </div>
                <Badge tone={entry.outcome}>{entry.outcome.toUpperCase()}</Badge>
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Active Loads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <th className="px-5 py-2.5 font-medium">Lane</th>
                <th className="px-5 py-2.5 font-medium">Equipment</th>
                <th className="px-5 py-2.5 font-medium">Rate</th>
                <th className="px-5 py-2.5 font-medium">Pickup</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">
                      {load.origin} → {load.destination}
                    </div>
                    <div className="text-xs text-slate-400">{load.commodity}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{load.equipmentType}</td>
                  <td className="px-5 py-3 text-slate-900 font-medium">${load.rate.toLocaleString()}</td>
                  <td className="px-5 py-3 text-slate-600">{load.pickupDate}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[load.status] ?? "info"}>{load.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

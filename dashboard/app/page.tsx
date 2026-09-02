import { loads, stats, approvals } from "@/lib/demo-data";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";
import Link from "next/link";

const STATUS_TONE: Record<string, string> = {
  Available: "info",
  "Offer Sent": "success",
  "Awaiting Review": "warning",
  Booked: "success",
};

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="What the agent swarm is working on right now, and what needs your attention."
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
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

      <Card>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Active Loads</h2>
        </div>
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
      </Card>
    </div>
  );
}

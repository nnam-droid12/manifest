import { onTimePerformance, marginByLane, fraudFlagsOverTime, stats } from "@/lib/demo-data";
import { Card, PageHeader, StatCard } from "@/components/ui";

function HBar({ label, value, max, formatValue }: { label: string; value: number; max: number; formatValue: (v: number) => string }) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">{formatValue(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const maxMargin = Math.max(...marginByLane.map((l) => l.marginPct));
  const maxFlags = Math.max(1, ...fraudFlagsOverTime.map((f) => f.flags));

  return (
    <div>
      <PageHeader title="Analytics" description="What the agent swarm's activity adds up to over time." />

      <Card className="mb-8 px-5 py-3 bg-slate-50 border-slate-200">
        <p className="text-xs text-slate-500">
          On-time performance and margin trend below are illustrative — they need a live population of
          completed shipments that doesn&apos;t exist until the swarm has been running in production for a
          while. Fraud flags caught reflects this session&apos;s actual verified run (see{" "}
          <a href="/audit" className="underline">
            Audit Trail
          </a>
          ).
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Fraud Flags Caught (Sep)" value={String(stats.fraudFlagsCaught)} />
        <StatCard label="Avg. Margin" value={`${stats.avgMarginPct}%`} sub="Across active lanes" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">On-Time Performance by Carrier</h2>
          <div className="space-y-4">
            {onTimePerformance.map((c) => (
              <HBar key={c.carrier} label={c.carrier} value={c.onTimePct} max={100} formatValue={(v) => `${v}%`} />
            ))}
          </div>
        </Card>

        <Card className="px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Margin by Lane</h2>
          <div className="space-y-4">
            {marginByLane.map((l) => (
              <HBar
                key={l.lane}
                label={l.lane}
                value={l.marginPct}
                max={maxMargin}
                formatValue={(v) => `${v}%`}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card className="px-5 py-4 mt-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Fraud Flags Caught, By Month</h2>
        <div className="flex items-end gap-6 h-32">
          {fraudFlagsOverTime.map((f) => (
            <div key={f.month} className="flex flex-col items-center gap-2 flex-1">
              <div
                className="w-full max-w-[48px] rounded-t-md bg-ink"
                style={{ height: `${Math.max(4, (f.flags / maxFlags) * 100)}px` }}
              />
              <span className="text-xs text-slate-500">{f.month}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

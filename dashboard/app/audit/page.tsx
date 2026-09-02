import { auditTrail } from "@/lib/demo-data";
import { Card, Badge, PageHeader } from "@/components/ui";

export default function AuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Every agent action, with its full reasoning — so you can see exactly why the system did what it did, not just that it did something."
      />

      <div className="space-y-4">
        {auditTrail.map((entry) => (
          <Card key={entry.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{entry.agent}</span>
                  {entry.loadId && (
                    <span className="text-xs text-slate-400">Load {entry.loadId}</span>
                  )}
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
            <p className="text-sm text-slate-600 mt-3 leading-relaxed border-t border-slate-100 pt-3">
              {entry.reasoning}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

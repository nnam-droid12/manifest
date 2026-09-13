import { PageHeader } from "@/components/ui";
import LiveInvestigationLoader from "@/components/LiveInvestigationLoader";

export default function InvestigatePage() {
  return (
    <div>
      <PageHeader
        title="Live Investigation"
        description="Type any carrier, company, or MC number and watch a real, isolated cloud browser search for it live — not a replay, and not a fixed demo. Try it with the flagged carrier from Approvals (MC-1187765, Apex Haulers Group), or anything else."
      />
      <LiveInvestigationLoader />
    </div>
  );
}

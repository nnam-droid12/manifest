import { PageHeader } from "@/components/ui";
import LiveInvestigationLoader from "@/components/LiveInvestigationLoader";

export default function InvestigatePage() {
  return (
    <div>
      <PageHeader
        title="Live Investigation"
        description="Type any carrier, company, or MC number — it opens a real search in a new tab immediately, and starts a real, isolated Bedrock AgentCore browser session running the same query in parallel. Try it with the flagged carrier from Approvals (MC-1187765, Apex Haulers Group), or anything else."
      />
      <LiveInvestigationLoader />
    </div>
  );
}

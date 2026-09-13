import { PageHeader } from "@/components/ui";
import LiveInvestigationLoader from "@/components/LiveInvestigationLoader";

export default function InvestigatePage() {
  return (
    <div>
      <PageHeader
        title="Live Investigation"
        description='Speak or type a request like "open amazon with a ring camera and compare the cost" — real Amazon Comprehend extracts the item, a real isolated Bedrock AgentCore browser agent reads live market prices via Rekognition OCR, and real Amazon Polly speaks back a verdict against the value declared on the shipment.'
      />
      <LiveInvestigationLoader />
    </div>
  );
}

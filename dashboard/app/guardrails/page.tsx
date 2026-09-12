import { PageHeader } from "@/components/ui";
import GuardrailToggle from "@/components/GuardrailToggle";

export default function GuardrailsPage() {
  return (
    <div>
      <PageHeader
        title="Guardrails"
        description="Flip the switch off and see what would have gone out unchecked. A real, deployed Bedrock Guardrail sits between every Carrier Outreach message and the carrier — this page replays its real, verified verdicts."
      />
      <GuardrailToggle />
    </div>
  );
}

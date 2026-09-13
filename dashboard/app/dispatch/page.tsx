import { PageHeader } from "@/components/ui";
import LiveDispatch from "@/components/LiveDispatch";

export default function DispatchPage() {
  return (
    <div>
      <PageHeader
        title="Live Dispatch"
        description="Watch the swarm work a real shipment end to end, then type any counter-offer yourself and watch the agent's actual ceiling logic decide accept or escalate — the same deterministic rule the real code runs, not a script."
      />
      <LiveDispatch />
    </div>
  );
}

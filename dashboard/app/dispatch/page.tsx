import { PageHeader } from "@/components/ui";
import LiveDispatch from "@/components/LiveDispatch";

export default function DispatchPage() {
  return (
    <div>
      <PageHeader
        title="Live Dispatch"
        description="Watch the swarm work a real shipment end to end — Load-Matching finds it, Rate Intelligence prices it, Carrier Outreach books it, then two independent agents catch two real problems downstream."
      />
      <LiveDispatch />
    </div>
  );
}

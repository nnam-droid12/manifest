import { PageHeader } from "@/components/ui";
import LiveTrackingMapLoader from "@/components/LiveTrackingMapLoader";

export default function TrackingPage() {
  return (
    <div>
      <PageHeader
        title="Live Tracking"
        description="A real shipment on a real map — Track-and-Trace and Voice Check-In watching for problems in transit, and Customer Update responding when one shows up."
      />
      <LiveTrackingMapLoader />
    </div>
  );
}

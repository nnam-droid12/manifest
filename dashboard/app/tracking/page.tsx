import { PageHeader } from "@/components/ui";
import LiveTrackingMapLoader from "@/components/LiveTrackingMapLoader";

export default function TrackingPage() {
  return (
    <div>
      <PageHeader
        title="Live Tracking"
        description="Click anywhere on the map to place a disruption — the agent reverse-geocodes the real location and computes a genuinely new ETA and customer message from that exact point, not a scripted route."
      />
      <LiveTrackingMapLoader />
    </div>
  );
}

import { PageHeader } from "@/components/ui";
import CargoInspector from "@/components/CargoInspector";

export default function CargoPage() {
  return (
    <div>
      <PageHeader
        title="Cargo Inspector"
        description="Upload your own pickup and delivery photos — a real Amazon Rekognition call analyzes each one live and shows what actually changed, not a scripted verdict on two fixed images."
      />
      <CargoInspector />
    </div>
  );
}

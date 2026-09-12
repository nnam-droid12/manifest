import { PageHeader } from "@/components/ui";
import CargoInspector from "@/components/CargoInspector";

export default function CargoPage() {
  return (
    <div>
      <PageHeader
        title="Cargo Inspector"
        description="The Cargo Condition Agent compares pickup and delivery photos and flags real discrepancies — no human eyeballing two photos side by side."
      />
      <CargoInspector />
    </div>
  );
}

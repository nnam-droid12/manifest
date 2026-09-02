import sys

from manifest_agents.customer_update.agent import draft_update

if __name__ == "__main__":
    shipment_id = sys.argv[1] if len(sys.argv) > 1 else "SHP-3001"
    customer_name = sys.argv[2] if len(sys.argv) > 2 else "Halden Foods"
    trigger = (
        sys.argv[3]
        if len(sys.argv) > 3
        else "Track-and-Trace Agent flagged a delay: ETA has slipped 2 days past the promised delivery date."
    )
    result = draft_update(shipment_id, customer_name, trigger)
    print(result.narrative)

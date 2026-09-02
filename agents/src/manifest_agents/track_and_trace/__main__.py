import sys

from manifest_agents.track_and_trace.agent import check_shipment

if __name__ == "__main__":
    shipment_id = sys.argv[1] if len(sys.argv) > 1 else "SHP-3001"
    promised_delivery_date = sys.argv[2] if len(sys.argv) > 2 else "2026-09-07"
    result = check_shipment(shipment_id, promised_delivery_date)
    print(result.narrative)

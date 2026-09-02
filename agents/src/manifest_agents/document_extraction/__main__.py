from pathlib import Path

from manifest_agents.document_extraction.agent import reconcile_document

if __name__ == "__main__":
    doc_path = (
        Path(__file__).resolve().parents[4] / "seed-data" / "documents" / "rate_confirmation_REF-88213.png"
    )
    result = reconcile_document(
        str(doc_path),
        expected_terms={
            "rate": "$1,650.00",
            "carrier": "Swiftline Freight LLC",
            "reference_number": "REF-88213",
            "pickup_date": "09/04/2026",
            "delivery_date": "09/07/2026",
        },
    )
    print(result.narrative)

from manifest_agents.tools.carrier_records import get_broker_carrier_record


def test_known_carrier_returns_record():
    record = get_broker_carrier_record("MC-1187765")
    assert record["legal_name"] == "Apex Haulers Group"
    assert record["remit_to_name"] == "Silverline Payables LLC"


def test_unknown_carrier_returns_error():
    record = get_broker_carrier_record("MC-0000000")
    assert "error" in record

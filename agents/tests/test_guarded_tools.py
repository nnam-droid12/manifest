from manifest_agents.carrier_outreach.guarded_tools import send_rate_offer


def test_offer_above_ceiling_is_refused_without_sending():
    result = send_rate_offer(
        load_id="1002",
        offer_rate=2000,
        ceiling_rate=1680,
        contact_email="broker@manifest-demo.example",
        message="Test offer that should never be sent.",
    )
    assert result["sent"] is False
    assert "exceeds the authorized ceiling" in result["reason"]

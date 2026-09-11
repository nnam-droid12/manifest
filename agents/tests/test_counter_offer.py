from manifest_agents.carrier_outreach.guarded_tools import evaluate_counter_offer


def test_counter_within_ceiling_is_accept():
    result = evaluate_counter_offer(counter_rate=1600, ceiling_rate=1680)
    assert result["within_ceiling"] is True
    assert result["action"] == "accept"
    assert result["margin_vs_ceiling"] == 80


def test_counter_above_ceiling_is_escalate():
    result = evaluate_counter_offer(counter_rate=1750, ceiling_rate=1680)
    assert result["within_ceiling"] is False
    assert result["action"] == "escalate"
    assert result["margin_vs_ceiling"] == -70


def test_counter_exactly_at_ceiling_is_accept():
    result = evaluate_counter_offer(counter_rate=1680, ceiling_rate=1680)
    assert result["within_ceiling"] is True
    assert result["action"] == "accept"

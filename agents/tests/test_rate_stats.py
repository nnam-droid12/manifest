from manifest_agents.tools.rate_stats import compute_rate_stats, get_market_conditions


def test_compute_rate_stats_known_lane():
    stats = compute_rate_stats("Chicago, IL", "Atlanta, GA", "Reefer")
    assert stats["sample_size"] == 4
    assert stats["mean"] == 1595.0
    assert stats["median"] == 1595.0
    assert stats["min"] == 1520
    assert stats["max"] == 1670


def test_compute_rate_stats_thin_sample_returns_error():
    stats = compute_rate_stats("Nowhere, XX", "Nowhere Else, YY", "Dry Van")
    assert "error" in stats


def test_get_market_conditions_known_lane():
    conditions = get_market_conditions("Chicago, IL", "Atlanta, GA")
    assert conditions["trend"] == "rising"
    assert conditions["load_to_truck_ratio"] == 3.4


def test_get_market_conditions_unknown_lane_returns_error():
    conditions = get_market_conditions("Nowhere, XX", "Nowhere Else, YY")
    assert "error" in conditions

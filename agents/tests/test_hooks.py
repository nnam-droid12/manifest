from strands.hooks import AfterToolCallEvent, BeforeToolCallEvent

from manifest_agents.hooks import RateLimiterHookProvider, RequireCallFirstHookProvider


def _before_event(tool_name: str) -> BeforeToolCallEvent:
    return BeforeToolCallEvent(
        agent=None,
        selected_tool=None,
        tool_use={"name": tool_name, "toolUseId": "1", "input": {}},
        invocation_state={},
    )


def _after_event(tool_name: str, exception: Exception | None = None) -> AfterToolCallEvent:
    return AfterToolCallEvent(
        agent=None,
        selected_tool=None,
        tool_use={"name": tool_name, "toolUseId": "1", "input": {}},
        invocation_state={},
        result={},
        exception=exception,
        duration=0.01,
    )


def test_rate_limiter_allows_up_to_max_calls():
    provider = RateLimiterHookProvider(max_calls_per_tool=2)
    e1, e2 = _before_event("lookup_carrier_by_mc"), _before_event("lookup_carrier_by_mc")
    provider._check_limit(e1)
    provider._check_limit(e2)
    assert e1.cancel_tool is False
    assert e2.cancel_tool is False


def test_rate_limiter_cancels_after_max_calls():
    provider = RateLimiterHookProvider(max_calls_per_tool=2)
    for _ in range(2):
        provider._check_limit(_before_event("lookup_carrier_by_mc"))
    third = _before_event("lookup_carrier_by_mc")
    provider._check_limit(third)
    assert third.cancel_tool is not False
    assert "rate limit" in str(third.cancel_tool).lower()


def test_rate_limiter_tracks_each_tool_independently():
    provider = RateLimiterHookProvider(max_calls_per_tool=1)
    provider._check_limit(_before_event("lookup_carrier_by_mc"))
    other_tool_event = _before_event("search_playbook")
    provider._check_limit(other_tool_event)
    assert other_tool_event.cancel_tool is False


def test_require_call_first_blocks_gated_tool_before_prerequisite():
    provider = RequireCallFirstHookProvider(gated_tool="send_rate_offer", prerequisite_tool="get_load_detail")
    gated = _before_event("send_rate_offer")
    provider._enforce_order(gated)
    assert gated.cancel_tool is not False
    assert "get_load_detail" in str(gated.cancel_tool)


def test_require_call_first_allows_gated_tool_after_prerequisite_succeeds():
    provider = RequireCallFirstHookProvider(gated_tool="send_rate_offer", prerequisite_tool="get_load_detail")
    provider._track_prerequisite(_after_event("get_load_detail"))
    gated = _before_event("send_rate_offer")
    provider._enforce_order(gated)
    assert gated.cancel_tool is False


def test_require_call_first_ignores_failed_prerequisite_call():
    provider = RequireCallFirstHookProvider(gated_tool="send_rate_offer", prerequisite_tool="get_load_detail")
    provider._track_prerequisite(_after_event("get_load_detail", exception=RuntimeError("boom")))
    gated = _before_event("send_rate_offer")
    provider._enforce_order(gated)
    assert gated.cancel_tool is not False


def test_require_call_first_does_not_block_unrelated_tools():
    provider = RequireCallFirstHookProvider(gated_tool="send_rate_offer", prerequisite_tool="get_load_detail")
    unrelated = _before_event("search_playbook")
    provider._enforce_order(unrelated)
    assert unrelated.cancel_tool is False

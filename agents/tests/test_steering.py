from strands.hooks import BeforeToolCallEvent

from manifest_agents.steering import (
    SteeringHookProvider,
    SteeringOutcome,
    SteeringVerdict,
    check_outreach_overreach,
)


def _before_event(tool_name: str, tool_input: dict) -> BeforeToolCallEvent:
    return BeforeToolCallEvent(
        agent=None,
        selected_tool=None,
        tool_use={"name": tool_name, "toolUseId": "1", "input": tool_input},
        invocation_state={},
    )


def test_overreach_checker_approves_a_clean_offer():
    outcome = check_outreach_overreach(
        {"message": "We'd like to offer $1,650 for this Chicago to Atlanta reefer load."}
    )
    assert outcome.verdict == SteeringVerdict.APPROVE


def test_overreach_checker_catches_guarantee_language():
    outcome = check_outreach_overreach({"message": "We guarantee this rate for all future loads."})
    assert outcome.verdict == SteeringVerdict.GUIDE
    assert "guarantee" in outcome.feedback.lower()


def test_overreach_checker_catches_uncapped_detention():
    outcome = check_outreach_overreach({"message": "We'll cover detention pay with no limit."})
    assert outcome.verdict == SteeringVerdict.GUIDE
    assert outcome.feedback is not None


def test_overreach_checker_catches_binding_agreement_language():
    outcome = check_outreach_overreach({"message": "Consider this a signed agreement."})
    assert outcome.verdict == SteeringVerdict.GUIDE


def test_steering_hook_cancels_on_guide_with_specific_feedback():
    provider = SteeringHookProvider(tool_name="send_rate_offer", checker=check_outreach_overreach)
    event = _before_event("send_rate_offer", {"message": "We promise you future loads too."})
    provider._steer(event)
    assert event.cancel_tool is not False
    assert "promise" in str(event.cancel_tool).lower()
    assert provider.last_verdict == SteeringVerdict.GUIDE


def test_steering_hook_approves_clean_message():
    provider = SteeringHookProvider(tool_name="send_rate_offer", checker=check_outreach_overreach)
    event = _before_event("send_rate_offer", {"message": "We'd like to offer $1,500 for this load."})
    provider._steer(event)
    assert event.cancel_tool is False
    assert provider.last_verdict == SteeringVerdict.APPROVE


def test_steering_hook_ignores_other_tools():
    provider = SteeringHookProvider(tool_name="send_rate_offer", checker=check_outreach_overreach)
    event = _before_event("get_load_detail", {})
    provider._steer(event)
    assert event.cancel_tool is False
    assert provider.last_verdict is None


def test_steering_outcome_reject_also_cancels():
    def always_reject(_input: dict) -> SteeringOutcome:
        return SteeringOutcome(verdict=SteeringVerdict.REJECT, feedback="not allowed")

    provider = SteeringHookProvider(tool_name="send_rate_offer", checker=always_reject)
    event = _before_event("send_rate_offer", {"message": "anything"})
    provider._steer(event)
    assert event.cancel_tool == "not allowed"

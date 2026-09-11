from strands import tool

from manifest_agents.tools.browser import submit_load_board_offer
from manifest_agents.tools.guardrails import check_outreach_guardrail


@tool
def send_rate_offer(
    load_id: str, offer_rate: float, ceiling_rate: float, contact_email: str, message: str
) -> dict:
    """Send a rate offer to the carrier for a load — the only way outreach reaches a carrier.

    Enforces the negotiation ceiling deterministically before anything is sent:
    this check does not depend on the model following instructions correctly,
    it is a hard stop in code. A Bedrock Guardrails check on the message text
    runs as a second layer (best-effort — see check_outreach_guardrail).

    Args:
        load_id: The load board's identifier for the load.
        offer_rate: The rate being offered to the carrier, in dollars.
        ceiling_rate: The maximum rate this agent is authorized to offer for
            this load, as set by the Rate Intelligence Agent / broker. Must be
            supplied by the caller from context — never inferred.
        contact_email: Reply-to email address for the carrier's response.
        message: The offer message body.

    Returns:
        A dict describing what happened: either a refusal (ceiling or
        guardrail violation, nothing was sent) or a submission confirmation.
    """
    if offer_rate > ceiling_rate:
        return {
            "sent": False,
            "reason": f"Refused: offer ${offer_rate:,.0f} exceeds the authorized ceiling "
            f"${ceiling_rate:,.0f}. This requires broker approval before it can be sent — "
            "nothing was submitted to the carrier.",
        }

    guardrail_result = check_outreach_guardrail(message)
    if guardrail_result.get("blocked"):
        return {
            "sent": False,
            "reason": f"Refused: Bedrock Guardrails flagged this message — {guardrail_result.get('reason')}. "
            "Nothing was submitted to the carrier.",
        }

    submission = submit_load_board_offer(load_id, offer_rate, contact_email, message)
    return {
        "sent": submission["submitted"],
        "offer_rate": offer_rate,
        "guardrail_checked": guardrail_result.get("checked", False),
    }


@tool
def evaluate_counter_offer(counter_rate: float, ceiling_rate: float) -> dict:
    """Deterministically evaluate a carrier's counter-offer against the authorized ceiling.

    The only source of truth for "is this counter acceptable" — see the
    counter-offer-handling skill for the full procedure this feeds into.
    Not a judgment call: a straight comparison, always computed the same way
    regardless of how the model is inclined to read the numbers.

    Args:
        counter_rate: The rate the carrier countered with, in dollars.
        ceiling_rate: The maximum rate this agent is authorized to offer for this load.

    Returns:
        {within_ceiling, action, margin_vs_ceiling} — action is one of
        "accept" (send_rate_offer at counter_rate) or "escalate" (report to
        the broker, do not send anything).
    """
    within_ceiling = counter_rate <= ceiling_rate
    return {
        "within_ceiling": within_ceiling,
        "action": "accept" if within_ceiling else "escalate",
        "margin_vs_ceiling": round(ceiling_rate - counter_rate, 2),
    }

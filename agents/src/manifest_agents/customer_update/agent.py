from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.browser import check_shipment_status

SYSTEM_PROMPT = """\
You are the Customer Update Agent for Manifest, an AI freight brokerage system.

Your job is to draft a short, plain-language status update for the broker's
customer (the shipper) — the company whose freight this is, not the carrier.
You write the message; the broker reviews it before it goes out.

Rules:
- Always call check_shipment_status first to ground the update in the actual
  current status, not just the trigger reason you were given.
- You will be told why an update is being sent: either a routine milestone
  (e.g. picked up, delivered) or a delay the Track-and-Trace Agent decided
  was significant enough to escalate.
- Write for a business customer, not a logistics professional: no internal
  jargon (no "ETA slipped", no raw status codes) — say what's actually
  happening and what it means for them in plain terms.
- If this is a delay update: be direct about the delay and the new expected
  timing, do not bury it or over-apologize, and do not promise a firm new
  date unless the shipment data actually supports one.
- If this is a milestone update: keep it brief and positive, no need to
  over-explain.
- Never mention internal details the customer has no reason to see (agent
  names, internal risk assessments, negotiated rates, other agents' actions).
- End your output with the ready-to-send message on its own, clearly marked,
  so the broker can review and send it with one glance — not a message
  buried in your own commentary.
"""


@dataclass
class UpdateResult:
    shipment_id: str
    narrative: str


def build_customer_update_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[check_shipment_status],
    )


def draft_update(shipment_id: str, customer_name: str, trigger: str) -> UpdateResult:
    agent = build_customer_update_agent()
    result = agent(
        f"Draft a customer update for {customer_name} about shipment {shipment_id}. "
        f"Reason for this update: {trigger}."
    )
    return UpdateResult(shipment_id=shipment_id, narrative=str(result))

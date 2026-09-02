from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.browser import check_shipment_status

SYSTEM_PROMPT = """\
You are the Track-and-Trace Agent for Manifest, an AI freight brokerage system.

Your job is to check on an active shipment and decide whether its progress is
actually a problem worth escalating to the broker, or just normal variation
that doesn't need a human's attention.

Rules:
- Always call check_shipment_status first. Don't guess at a shipment's status.
- You will be told the shipment's promised delivery date, as agreed with the
  carrier. Compare the portal's current status, ETA, and last-update time
  against that promise.
- Reason explicitly about significance, not just presence of a delay:
  - A shipment still "In Transit" with an ETA on or before the promised
    delivery date is on track — no escalation, even if it hasn't updated in a
    few hours (trucks don't ping continuously).
  - An ETA that has slipped past the promised delivery date is a real delay —
    escalate, and say by how much.
  - A status that hasn't updated in an unusually long time relative to the
    shipment's stage (e.g. still "Dispatched" when it should be well into
    transit) is itself a signal worth surfacing, even before the delivery
    date is technically missed — silence isn't the same as on-time.
  - "Delivered" needs no escalation regardless of exact timing, unless it
    delivered notably late.
- Do not escalate just because you technically found a delay of a few
  minutes or an ETA that's still same-day — the broker's time is valuable;
  reserve escalation for delays or silences that would actually change what
  a human should do next (e.g. call the customer, call the carrier).
- State your decision plainly: "on track, no action needed" or "escalate:
  <reason>", and show the actual data (status, ETA, last update, promised
  date) you based it on.
"""


@dataclass
class TraceResult:
    shipment_id: str
    narrative: str


def build_track_and_trace_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[check_shipment_status],
    )


def check_shipment(shipment_id: str, promised_delivery_date: str) -> TraceResult:
    agent = build_track_and_trace_agent()
    result = agent(
        f"Check shipment {shipment_id}. Promised delivery date (as agreed with the carrier): "
        f"{promised_delivery_date}. Decide whether this needs to be escalated to the broker."
    )
    return TraceResult(shipment_id=shipment_id, narrative=str(result))

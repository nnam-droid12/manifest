from dataclasses import dataclass

from strands import Agent

from manifest_agents.carrier_outreach.guarded_tools import send_rate_offer
from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.browser import get_load_detail

SYSTEM_PROMPT = """\
You are the Carrier Outreach Agent for Manifest, an AI freight brokerage system.

You are given a load, a target rate, and a hard ceiling rate set by the Rate
Intelligence Agent / broker. Your job is to draft and send a rate offer to the
carrier for this load.

Rules:
- Call get_load_detail first to confirm the load's current status and terms
  before offering on it.
- Open with the target rate, not the ceiling. The target is where you should
  try to land; the ceiling is the absolute maximum you are authorized to go
  to, not a starting point.
- You are NEVER authorized to offer above the ceiling rate under any
  circumstance, framing, or justification. send_rate_offer enforces this in
  code regardless of what you decide, but do not attempt to work around it —
  if you believe a higher rate is warranted, say so in your final report as a
  recommendation for the broker, do not try to send it.
- Write a professional, concrete offer message: reference the load's origin,
  destination, and equipment, and state the rate clearly. Do not make any
  commitment beyond the rate itself (no promises about future loads, no
  guarantees, no accessorial terms) — you are not authorized to negotiate
  anything except the linehaul rate in this pass.
- After sending, report plainly whether the offer was actually sent, and if
  it was refused (ceiling or guardrail), explain why and what the broker
  needs to do next.
"""


@dataclass
class OutreachResult:
    load_id: str
    narrative: str


def build_carrier_outreach_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[get_load_detail, send_rate_offer],
    )


def make_offer(load_id: str, target_rate: float, ceiling_rate: float, contact_email: str) -> OutreachResult:
    agent = build_carrier_outreach_agent()
    result = agent(
        f"Make an offer on load {load_id}. Target rate: ${target_rate:,.0f}. "
        f"Ceiling rate (hard cap, never exceed): ${ceiling_rate:,.0f}. "
        f"Reply-to contact email for this offer: {contact_email}."
    )
    return OutreachResult(load_id=load_id, narrative=str(result))

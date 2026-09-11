from dataclasses import dataclass
from pathlib import Path

from strands import Agent, AgentSkills

from manifest_agents.carrier_outreach.guarded_tools import evaluate_counter_offer, send_rate_offer
from manifest_agents.hooks import RequireCallFirstHookProvider
from manifest_agents.models import get_reasoning_model
from manifest_agents.steering import SteeringHookProvider, check_outreach_overreach
from manifest_agents.tools.browser import get_load_detail

_SKILLS_DIR = Path(__file__).resolve().parents[3] / "skills"

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
- If you are told the carrier came back with a counter-offer instead of
  accepting, load the counter-offer-handling skill and follow it exactly —
  do not decide by feel whether a counter is acceptable.
"""


@dataclass
class OutreachResult:
    load_id: str
    narrative: str


def build_carrier_outreach_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[get_load_detail, send_rate_offer, evaluate_counter_offer],
        # Structural guarantee, not a prompt hope: send_rate_offer is refused
        # by the hook — before it ever runs — unless get_load_detail has
        # already succeeded in this conversation (hooks.py). Steering then
        # separately reviews the draft message itself and redirects the
        # agent to redraft if it overreaches beyond the rate (steering.py) —
        # two different questions ("did you check first?" vs. "is this
        # actually okay to send?"), both enforced structurally.
        hooks=[
            RequireCallFirstHookProvider(gated_tool="send_rate_offer", prerequisite_tool="get_load_detail"),
            SteeringHookProvider(tool_name="send_rate_offer", checker=check_outreach_overreach),
        ],
        # Progressive disclosure: the counter-offer procedure only loads
        # into context when the agent actually needs it (see
        # skills/counter-offer-handling/SKILL.md) — most calls to this agent
        # never negotiate a counter, so it stays out of the system prompt by
        # default.
        plugins=[AgentSkills(skills=_SKILLS_DIR / "counter-offer-handling")],
    )


def make_offer(load_id: str, target_rate: float, ceiling_rate: float, contact_email: str) -> OutreachResult:
    agent = build_carrier_outreach_agent()
    result = agent(
        f"Make an offer on load {load_id}. Target rate: ${target_rate:,.0f}. "
        f"Ceiling rate (hard cap, never exceed): ${ceiling_rate:,.0f}. "
        f"Reply-to contact email for this offer: {contact_email}."
    )
    return OutreachResult(load_id=load_id, narrative=str(result))


def negotiate_with_counter(
    load_id: str,
    target_rate: float,
    ceiling_rate: float,
    contact_email: str,
    carrier_counter_rate: float,
) -> OutreachResult:
    """Same as make_offer, then continues the same conversation with the
    carrier's counter-offer as a follow-up turn — exercises the
    counter-offer-handling skill and evaluate_counter_offer end to end."""
    agent = build_carrier_outreach_agent()
    agent(
        f"Make an offer on load {load_id}. Target rate: ${target_rate:,.0f}. "
        f"Ceiling rate (hard cap, never exceed): ${ceiling_rate:,.0f}. "
        f"Reply-to contact email for this offer: {contact_email}."
    )
    result = agent(
        f"The carrier responded with a counter-offer of ${carrier_counter_rate:,.0f} instead of "
        "accepting. Handle it."
    )
    return OutreachResult(load_id=load_id, narrative=str(result))

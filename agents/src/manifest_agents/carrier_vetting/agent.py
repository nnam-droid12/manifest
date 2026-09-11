from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field
from strands import Agent, AgentSkills

from manifest_agents.hooks import RateLimiterHookProvider
from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.carrier_records import get_broker_carrier_record
from manifest_agents.tools.fmcsa import lookup_carrier_by_dot, lookup_carrier_by_mc
from manifest_agents.tools.playbook import search_playbook

_SKILLS_DIR = Path(__file__).resolve().parents[3] / "skills"

SYSTEM_PROMPT = """\
You are the Carrier Vetting & Fraud Detection Agent for Manifest, an AI freight
brokerage system. Your job is to assess whether a carrier is safe to engage —
this is a trust-and-safety function, not a formality, and freight double-brokering
fraud is a real and growing problem in this industry.

For every carrier you assess, call BOTH of the following tools before writing
any assessment — always both, regardless of what either one returns. A failed
or erroring FMCSA lookup is not a reason to skip the broker-record check; if
anything it makes that second check more important, not less:
1. Call lookup_carrier_by_mc (or lookup_carrier_by_dot if only a DOT number is
   given) to get the carrier's official FMCSA registration.
2. Call get_broker_carrier_record to get the broker's own on-file contact and
   remit-to (payment) details for this carrier.
3. Call search_playbook with the carrier's name for any standing broker rule
   about this specific carrier.

Then load the fraud-investigation-checklist skill and work through it in full
using the data you just gathered — it has the complete red-flag checklist and
scoring rubric, and it is not optional just because a carrier looks clean at
a glance.

Do not just output a bare score. Produce a plain-language risk assessment: what
you checked, exactly what you found, and why it does or doesn't concern you.
Be concrete. "Something feels off" is not an assessment; "the remit-to email
domain (silverlinepayables-invoices.com) does not match the carrier's legal
name or registered domain" is.
"""


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VettingAssessment(BaseModel):
    """Structured gate the Orchestrator relies on — not just the narrative.

    Consistent with how send_rate_offer enforces its ceiling in code rather
    than trusting a model's free-text output: whether outreach is allowed to
    proceed autonomously is too consequential to extract by parsing prose.
    """

    risk_level: RiskLevel
    autonomous_ok: bool = Field(
        description="True only if the Carrier Outreach Agent may proceed without human sign-off."
    )
    reason: str = Field(description="One-sentence reason for the risk level.")


@dataclass
class VettingResult:
    mc_number: str
    narrative: str
    assessment: VettingAssessment


def build_carrier_vetting_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[lookup_carrier_by_mc, lookup_carrier_by_dot, get_broker_carrier_record, search_playbook],
        # Each of these should be called once per assessment; 2 allows a
        # single retry without permitting a runaway loop against FMCSA's
        # public, rate-limited API.
        hooks=[RateLimiterHookProvider(max_calls_per_tool=2)],
        # Progressive disclosure: only the skill's name+description sit in
        # the system prompt by default; the full checklist (see
        # skills/fraud-investigation-checklist/SKILL.md) loads into context
        # only when the agent actually asks for it, not on every turn.
        plugins=[AgentSkills(skills=_SKILLS_DIR / "fraud-investigation-checklist")],
    )


def vet_carrier(mc_number: str) -> VettingResult:
    agent = build_carrier_vetting_agent()
    # Two calls, same reason as Rate Intelligence's recommend_rate: a
    # structured_output_model call replaces the final message with bare JSON,
    # which would lose the plain-language risk narrative. Get the narrative
    # first, then extract the structured gate as a follow-up on the same
    # conversation.
    narrative_result = agent(
        f"Assess carrier {mc_number} before we engage them for a load. "
        "Give your full risk assessment and autonomy recommendation."
    )
    gate_result = agent(
        "Now output exactly the risk level and autonomy decision you just gave, as structured data.",
        structured_output_model=VettingAssessment,
    )
    assessment = gate_result.structured_output or VettingAssessment(
        risk_level=RiskLevel.HIGH, autonomous_ok=False, reason="Structured output extraction failed."
    )
    return VettingResult(mc_number=mc_number, narrative=str(narrative_result), assessment=assessment)

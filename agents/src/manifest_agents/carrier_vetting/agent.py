from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field
from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.carrier_records import get_broker_carrier_record
from manifest_agents.tools.fmcsa import lookup_carrier_by_dot, lookup_carrier_by_mc

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
   given) to get the carrier's official FMCSA registration: operating authority
   status, physical address, insurance-on-file, safety rating, and how long ago
   authority was granted.
2. Call get_broker_carrier_record to get the broker's own on-file contact and
   remit-to (payment) details for this carrier.

Then:
3. Cross-reference the two. Specifically check for:
   - Remit-to name or email domain that does not match the carrier's legal name
     or an obvious derivative of it — a classic double-brokering red flag
     (payment being redirected to a third party).
   - Operating authority granted very recently (a fraudulent operator will often
     be operating under newly-issued or reactivated authority).
   - No broker-side record on file at all (first-time contact) combined with
     any other red flag above — treat that combination as elevated risk, since
     there's no track record to fall back on.
   - Authority status that isn't active, or insurance that appears to be
     missing or minimal.
   - A generic or non-corporate contact email domain (e.g. a public webmail
     provider) for what claims to be an established carrier.

If the FMCSA lookup tool returns an "error" (e.g. the API is unreachable or
misconfigured), do not silently skip that check or guess at authority status —
say plainly that FMCSA verification could not be completed, and factor that gap
itself into the risk level: an unverifiable carrier is not the same as a
verified-clean one, and should not be cleared for autonomous outreach.

Do not just output a bare score. Produce a plain-language risk assessment: what
you checked, exactly what you found, and why it does or doesn't concern you.
State a risk level (LOW, MEDIUM, or HIGH) and, critically, whether the Carrier
Outreach Agent should be allowed to proceed autonomously with this carrier or
must get human sign-off first — HIGH risk always requires human sign-off,
MEDIUM risk should note why a human might still want to glance at it even
though it isn't blocking.

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
        tools=[lookup_carrier_by_mc, lookup_carrier_by_dot, get_broker_carrier_record],
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

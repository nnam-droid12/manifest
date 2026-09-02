"""Coordinates the agent swarm across a single load's lifecycle.

Each step below is a real, independently-tested Strands Agent (see each
agent's own agent.py). The Orchestrator's job is specifically the handoff
and the autonomy gate between them — and that gate is enforced in Python,
not left to an LLM's judgment call, for the same reason send_rate_offer
enforces its ceiling in code: whether a HIGH-risk carrier gets contacted
autonomously is too consequential to depend on a model correctly declining
to call a tool. The Carrier Vetting Agent still reasons about the risk
level; the Orchestrator just refuses to proceed past it when the answer is
HIGH, unconditionally.

AgentCore Memory (persistent per-shipment state across the load's full
lifecycle) is the intended home for this state once the swarm is deployed
there — this function returns a single in-memory result for now rather than
persisting anything, since there's no deployed AgentCore runtime yet to
persist it to.
"""

from dataclasses import dataclass, field

from manifest_agents.carrier_outreach.agent import OutreachResult, make_offer
from manifest_agents.carrier_vetting.agent import VettingResult, vet_carrier
from manifest_agents.load_matching.agent import LaneCriteria, MatchResult, find_matches
from manifest_agents.rate_intelligence.agent import RateRecommendation, recommend_rate


@dataclass
class OrchestrationResult:
    status: str  # "no_match" | "requires_human_approval" | "offer_sent"
    summary: str
    load_matching: MatchResult
    carrier_vetting: VettingResult | None = None
    rate_intelligence: RateRecommendation | None = None
    carrier_outreach: OutreachResult | None = None
    steps_log: list[str] = field(default_factory=list)


def run_load_lifecycle(criteria: LaneCriteria, candidate_mc_number: str, contact_email: str) -> OrchestrationResult:
    """Run Load-Matching -> Carrier Vetting -> [gate] -> Rate Intelligence -> Carrier Outreach.

    candidate_mc_number is the carrier being considered for whichever load
    gets matched — in the real system this comes from whoever responds to
    the posted lane, not chosen by the orchestrator itself; passed in here
    since sourcing carrier responses isn't a built agent yet.
    """
    steps: list[str] = []

    steps.append(f"Load-Matching Agent: searching {criteria.origin} -> {criteria.destination}, "
                 f"{criteria.equipment_type or 'any equipment'}, floor ${criteria.rate_floor:,.0f}")
    match = find_matches(criteria)
    if not match.best_match or not match.best_match.best_load_id:
        steps.append("Load-Matching Agent: no load cleared the rate floor — stopping here.")
        return OrchestrationResult(
            status="no_match",
            summary="No load matched the broker's criteria.",
            load_matching=match,
            steps_log=steps,
        )
    load_id = match.best_match.best_load_id
    steps.append(f"Load-Matching Agent: best match is load {load_id} ({match.best_match.reason})")

    steps.append(f"Carrier Vetting & Fraud Detection Agent: assessing candidate carrier {candidate_mc_number}")
    vetting = vet_carrier(candidate_mc_number)
    steps.append(
        f"Carrier Vetting & Fraud Detection Agent: risk={vetting.assessment.risk_level.value}, "
        f"autonomous_ok={vetting.assessment.autonomous_ok} — {vetting.assessment.reason}"
    )

    if not vetting.assessment.autonomous_ok:
        steps.append(
            "Orchestrator: risk gate failed — Carrier Outreach Agent is NOT invoked. "
            "Escalating to broker for manual review before any contact with this carrier."
        )
        return OrchestrationResult(
            status="requires_human_approval",
            summary=(
                f"Load {load_id} matched, but carrier {candidate_mc_number} is "
                f"{vetting.assessment.risk_level.value} risk — human sign-off required before outreach."
            ),
            load_matching=match,
            carrier_vetting=vetting,
            steps_log=steps,
        )

    steps.append(
        f"Rate Intelligence Agent: recommending target/ceiling for {criteria.origin} -> "
        f"{criteria.destination}, {criteria.equipment_type}"
    )
    rate = recommend_rate(criteria.origin, criteria.destination, criteria.equipment_type)
    if not rate.figures:
        steps.append("Rate Intelligence Agent: no structured figures returned — stopping here for safety.")
        return OrchestrationResult(
            status="requires_human_approval",
            summary="Rate Intelligence Agent did not return usable figures — needs manual pricing.",
            load_matching=match,
            carrier_vetting=vetting,
            rate_intelligence=rate,
            steps_log=steps,
        )
    steps.append(
        f"Rate Intelligence Agent: target=${rate.figures.target_rate:,.0f}, "
        f"ceiling=${rate.figures.ceiling_rate:,.0f}"
    )

    steps.append(f"Carrier Outreach Agent: making offer on load {load_id}")
    outreach = make_offer(load_id, rate.figures.target_rate, rate.figures.ceiling_rate, contact_email)
    steps.append("Carrier Outreach Agent: done — see narrative for whether it was actually sent.")

    return OrchestrationResult(
        status="offer_sent",
        summary=(
            f"Load {load_id}: carrier {candidate_mc_number} cleared vetting "
            f"({vetting.assessment.risk_level.value} risk, autonomous), offer made at target "
            f"${rate.figures.target_rate:,.0f} (ceiling ${rate.figures.ceiling_rate:,.0f})."
        ),
        load_matching=match,
        carrier_vetting=vetting,
        rate_intelligence=rate,
        carrier_outreach=outreach,
        steps_log=steps,
    )

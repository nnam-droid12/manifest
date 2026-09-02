from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.rate_stats import compute_rate_stats, get_market_conditions

SYSTEM_PROMPT = """\
You are the Rate Intelligence Agent for Manifest, an AI freight brokerage system.

Given a lane (origin, destination) and equipment type, recommend a target rate
and a ceiling rate for the Carrier Outreach Agent to negotiate within.

Rules:
- Always call compute_rate_stats first. It gives you real statistics computed
  over the broker's own historical bookings for this exact lane and equipment
  — treat this as your primary evidence, not something to second-guess with a
  number from your own training data.
- Always call get_market_conditions too. A rising load-to-truck ratio means
  capacity is tight and carriers have leverage — that justifies recommending
  above the historical median, not just at it. A flat/low ratio means the
  historical median is a reasonable target as-is.
- If compute_rate_stats returns an error (too little history), say so plainly
  and give a wider, more conservative range, noting explicitly that it's a
  rough estimate due to thin data rather than presenting it with false
  confidence.
- Your target rate is what the Carrier Outreach Agent should open negotiation
  near. Your ceiling is the maximum it's authorized to go to without escalating
  to the broker — this is a hard cap, so don't set it so high it's meaningless.
- Show your work: state the actual numbers compute_rate_stats returned and how
  the market signal moved your recommendation, so the broker can see this is
  grounded in real data, not a guess.
"""


@dataclass
class RateRecommendation:
    origin: str
    destination: str
    equipment_type: str
    narrative: str


def build_rate_intelligence_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[compute_rate_stats, get_market_conditions],
    )


def recommend_rate(origin: str, destination: str, equipment_type: str) -> RateRecommendation:
    agent = build_rate_intelligence_agent()
    result = agent(
        f"Recommend a target and ceiling rate for {origin} -> {destination}, {equipment_type}."
    )
    return RateRecommendation(
        origin=origin, destination=destination, equipment_type=equipment_type, narrative=str(result)
    )

from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.browser import get_load_detail, search_load_board

SYSTEM_PROMPT = """\
You are the Load-Matching Agent for Manifest, an AI freight brokerage system.

Your job: given a broker's open lane criteria (origin, destination, equipment
type, and a minimum acceptable rate), search the load board and report back
only the loads that are genuinely worth the broker's attention.

Rules:
- Always call search_load_board first with the broker's criteria.
- For any promising result, call get_load_detail to confirm full details
  before recommending it — do not recommend a load from search results alone.
- A load is worth surfacing only if its rate meets or exceeds the broker's
  rate floor. Reject anything below it and say why.
- Report each recommended load with a one-line reason it's a good match
  (rate vs. floor, equipment match, timing), and note any rejected
  candidates and why you rejected them.
- Be concise. You are producing output a busy broker will skim.
"""


@dataclass
class LaneCriteria:
    origin: str
    destination: str
    equipment_type: str
    rate_floor: float


def build_load_matching_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[search_load_board, get_load_detail],
    )


def find_matches(criteria: LaneCriteria) -> str:
    agent = build_load_matching_agent()
    prompt = (
        f"Broker lane criteria — origin: {criteria.origin}, destination: {criteria.destination}, "
        f"equipment: {criteria.equipment_type}, minimum acceptable rate: ${criteria.rate_floor:,.0f}. "
        "Find and report matching loads."
    )
    result = agent(prompt)
    return str(result)

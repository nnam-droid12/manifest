from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.playbook import search_playbook

SYSTEM_PROMPT = """\
You are the Playbook & Lane-History Agent for Manifest, an AI freight
brokerage system. You are the swarm's institutional memory — other agents
(and the broker) ask you for relevant precedent before acting, so a lesson
learned once (a carrier to avoid, a customer's preference, a lane-specific
quirk) doesn't have to be relearned or rediscovered every time.

Rules:
- Always call search_playbook with a query capturing what's actually being
  decided (the carrier, customer, or lane in question), not a vague
  restatement of the question.
- If it returns relevant notes: state them plainly and say what they imply
  for the decision at hand. Quote the note rather than paraphrasing away the
  specific detail (a carrier name, a lane, a number) that makes it useful.
- If it returns nothing: say plainly that there's no playbook precedent for
  this, rather than inventing a plausible-sounding rule. No precedent is a
  real, useful answer — it means the broker is in genuinely new territory.
- You are advisory, not a gate: you surface precedent, you don't make the
  final call. Say what the precedent suggests, and let the asking agent or
  the broker decide how much weight to give it.
"""


@dataclass
class PlaybookResult:
    query: str
    narrative: str


def build_playbook_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[search_playbook],
    )


def consult_playbook(query: str) -> PlaybookResult:
    agent = build_playbook_agent()
    result = agent(f"Is there any playbook precedent relevant to: {query}")
    return PlaybookResult(query=query, narrative=str(result))

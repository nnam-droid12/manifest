from typing import Any
from collections import OrderedDict
from strands import Agent
from strands.agent.conversation_manager.null_conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from tools.fmcsa import lookup_carrier_by_mc, lookup_carrier_by_dot
from tools.carrier_records import get_broker_carrier_record
from tools.playbook import search_playbook

app = BedrockAgentCoreApp()
log = app.logger

# Standalone AgentCore Runtime hosting ONLY the Carrier Vetting & Fraud
# Detection Agent — deliberately separate from ManifestOrchestrator's
# runtime, so the Orchestrator calling this one (see
# ManifestOrchestrator/tools/carrier_vetting_client.py) is a genuine
# runtime-to-runtime AgentCore invocation, not an in-process tool call.
SYSTEM_PROMPT = """\
You are the Carrier Vetting & Fraud Detection Agent for Manifest, an AI
freight brokerage system. Your job is to assess whether a carrier is safe
to engage — this is a trust-and-safety function, not a formality, and
freight double-brokering fraud is a real and growing problem in this
industry.

For every carrier you assess, call BOTH of the following tools before
writing any assessment — always both, regardless of what either one
returns. A failed or erroring FMCSA lookup is not a reason to skip the
broker-record check; if anything it makes that second check more
important, not less:
1. lookup_carrier_by_mc (or lookup_carrier_by_dot if only a DOT number is
   given) — the carrier's official FMCSA registration.
2. get_broker_carrier_record — the broker's own on-file contact and
   remit-to (payment) details for this carrier.

Also call search_playbook with the carrier's name — the broker may have a
standing rule (a blacklist, a known equipment issue) that should override
or reinforce whatever FMCSA and the broker record show. A relevant note is
authoritative broker instruction, not just one more data point.

Cross-reference everything. Specifically check for: a remit-to name/email
domain that doesn't match the carrier's legal name (classic double-brokering
red flag — payment redirected to a third party); operating authority
granted very recently; no broker-side record at all combined with any other
red flag; authority status that isn't active or missing insurance; a
generic/non-corporate contact email domain. If FMCSA verification fails,
say so plainly and factor the gap itself into the risk level — unverifiable
is not the same as verified-clean.

Produce a plain-language risk assessment: what you checked, exactly what
you found, and why it does or doesn't concern you. Be concrete — cite the
actual remit-to domain, the actual playbook note text, not a vague
restatement.

End your response with exactly these two machine-readable lines, on their
own lines, nothing after them:
RISK_LEVEL: <LOW|MEDIUM|HIGH>
AUTONOMOUS_OK: <true|false>

AUTONOMOUS_OK must be false whenever RISK_LEVEL is HIGH — no exceptions.
"""

tools = [lookup_carrier_by_mc, lookup_carrier_by_dot, get_broker_carrier_record, search_playbook]


def _make_conversation_manager():
    return NullConversationManager()


def agent_factory():
    cache = OrderedDict()

    def get_or_create_agent(session_id):
        if session_id in cache:
            cache.move_to_end(session_id)
            return cache[session_id]
        if len(cache) >= 128:
            cache.popitem(last=False)
        cache[session_id] = Agent(
            model=load_model(),
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
            conversation_manager=_make_conversation_manager(),
        )
        return cache[session_id]

    return get_or_create_agent


get_or_create_agent = agent_factory()


def _extract_prompt(payload: dict):
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")
    prompt = payload.get("prompt", "")
    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string")
    return prompt


@app.entrypoint
async def invoke(payload, context):
    log.info("Invoking CarrierVettingAgent.....")

    session_id = getattr(context, "session_id", "default-session")
    agent = get_or_create_agent(session_id)
    prompt = _extract_prompt(payload)

    async for event in agent.stream_async(prompt):
        if not isinstance(event, dict) or "event" not in event:
            continue
        cbs = event["event"].get("contentBlockStart")
        if cbs is not None and not cbs.get("start"):
            continue
        yield event


if __name__ == "__main__":
    app.run()

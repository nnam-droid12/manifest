from typing import Any
from collections import OrderedDict
from strands import Agent, tool
import asyncio
import os
from strands.agent.conversation_manager.null_conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory import MemoryClient
from model.load import load_model
from tools.carrier_vetting_client import assess_carrier
from tools.rate_stats import compute_rate_stats, get_market_conditions
from tools.playbook import search_playbook
from tools.guardrails import check_outreach_guardrail

app = BedrockAgentCoreApp()
log = app.logger

# AgentCore Memory — persistent continuity for a load across its lifecycle,
# independent of the agent-instance cache below (which resets on cold start).
# MEMORY_SHIPMENTMEMORY_ID is injected by the "shipmentMemory" connection in
# agentcore.json (see wire-connections.js's MEMORY_<TOKEN>_ID convention).
_MEMORY_ID = os.environ.get("MEMORY_SHIPMENTMEMORY_ID")
_DEFAULT_TENANT_ID = "demo-broker"
_memory_client = MemoryClient(region_name=os.environ.get("AWS_REGION", "us-east-1")) if _MEMORY_ID else None
if not _MEMORY_ID:
    log.warning("MEMORY_SHIPMENTMEMORY_ID not set — running without per-load memory continuity.")

_TENANT_ID_PATTERN = __import__("re").compile(r"[^a-zA-Z0-9_-]")


def _actor_id_for_tenant(tenant_id: str) -> str:
    """Multi-tenant data isolation, not just a naming convention: the memory
    resource's SEMANTIC strategy uses namespaceTemplates:
    ["/users/{actorId}/facts"] (agentcore.json), so a distinct actor_id per
    tenant gives each broker organization a genuinely separate memory
    namespace at the AgentCore layer — one tenant's carrier findings are not
    retrievable, even accidentally, from another tenant's session. Sanitized
    because actor_id flows into that namespace path.
    """
    clean = _TENANT_ID_PATTERN.sub("", tenant_id.strip()) or _DEFAULT_TENANT_ID
    return f"broker-{clean}"[:128]


def _extract_tenant_id(payload: dict) -> str:
    if isinstance(payload, dict):
        tenant_id = payload.get("tenant_id")
        if isinstance(tenant_id, str) and tenant_id.strip():
            return tenant_id.strip()
    return _DEFAULT_TENANT_ID

DEFAULT_SYSTEM_PROMPT = """\
You are the Manifest Orchestrator, hosted on Amazon Bedrock AgentCore — the
control surface for an AI freight brokerage's trust-and-safety and pricing
capabilities. You can be asked to vet a carrier, recommend a rate for a
lane, consult broker playbook precedent, or check a message against the
outreach Guardrail. Use the tools available to answer with real data, not
guesses:

- assess_carrier: delegates a full carrier risk assessment to the
  standalone Carrier Vetting & Fraud Detection Agent — a genuinely separate
  AgentCore Runtime, not something you reason about yourself. Never assess
  FMCSA status or remit-to red flags directly; that judgment belongs to the
  dedicated agent. Report its narrative, risk_level, and autonomous_ok back
  plainly. If the delegate call itself fails (an "error" key), say so — do
  not invent a risk level to fill the gap.
- compute_rate_stats / get_market_conditions: real statistics over the
  broker's historical bookings and current market signal for a lane.
- search_playbook: the broker's own standing rules and precedent (customer
  preferences, lane quirks not specific to carrier vetting) — treat a
  relevant note as authoritative broker instruction.
- check_outreach_guardrail: runs text through the real deployed Bedrock
  Guardrail for this account.

Always call the relevant tool(s) before answering — never state a fact
(a carrier's risk level, a historical rate, a playbook rule) you could have
looked up or delegated. Be concrete and cite what the tools actually
returned.
"""


tools = [
    assess_carrier,
    compute_rate_stats,
    get_market_conditions,
    search_playbook,
    check_outreach_guardrail,
]

_INLINE_FUNCTION_NAMES = set()


def _make_conversation_manager():
    return NullConversationManager()

# Reuses one Agent per session_id so each session keeps its own in-process
# conversation history (best-effort; resets on cold start). The cache is bounded
# to 128 sessions with LRU eviction (least-recently-used is dropped and its
# history reset) so a single process serving many sessions cannot leak history
# between them or grow without limit. For durable history, attach a session manager.
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
            system_prompt=DEFAULT_SYSTEM_PROMPT,
            tools=tools,
            conversation_manager=_make_conversation_manager(),
            hooks=[
            ],
        )
        return cache[session_id]
    return get_or_create_agent
get_or_create_agent = agent_factory()


def strip_trailing_tool_use(messages: Any) -> list[dict]:
    """Strip toolUse blocks from the tail until the last message has none."""
    if not isinstance(messages, list):
        raise ValueError("messages must be a list")

    messages = list(messages)
    while messages:
        last = messages[-1]
        if not isinstance(last, dict):
            raise ValueError("each message must be an object")
        original_content = last.get("content", [])
        if not isinstance(original_content, list) or not all(isinstance(block, dict) for block in original_content):
            raise ValueError("each message content value must be a list of content blocks")

        content = [block for block in original_content if "toolUse" not in block]
        if len(content) == len(original_content):
            break
        if content:
            messages[-1] = {**last, "content": content}
            break
        messages.pop()

    return messages


def _extract_load_id(payload: dict) -> str | None:
    """Optional load_id in the payload keys this invocation into AgentCore Memory
    as its session_id, giving the Orchestrator continuity across separate
    invocations for the same load (a HIGH-risk carrier vetting today should
    still be known tomorrow, even on a fresh cold-started instance)."""
    if isinstance(payload, dict):
        load_id = payload.get("load_id")
        if isinstance(load_id, str) and load_id.strip():
            return load_id.strip()
    return None


def _load_prior_context(load_id: str, actor_id: str) -> str:
    """Real prior events for this load, from AgentCore Memory — not the
    in-process agent cache, which is lost on cold start. Best-effort: memory
    being unreachable degrades to "no known history" rather than failing the
    whole invocation. actor_id is tenant-scoped (see _actor_id_for_tenant) —
    a load_id collision across two different broker orgs still cannot cross
    into each other's memory, since actor_id is the tenant boundary here."""
    if not (_memory_client and _MEMORY_ID):
        return ""
    try:
        turns = _memory_client.list_events(
            memory_id=_MEMORY_ID, actor_id=actor_id, session_id=load_id, max_results=10
        )
    except Exception as e:
        log.warning(f"AgentCore Memory read failed for load {load_id} (actor {actor_id}): {e}")
        return ""
    if not turns:
        return ""
    lines = []
    for event in turns:
        for message in event.get("payload", []):
            conv = message.get("conversational", {})
            role = conv.get("role", "")
            text = conv.get("content", {}).get("text", "")
            if role and text:
                lines.append(f"[{role}] {text}")
    if not lines:
        return ""
    return (
        "Known history for this load, from AgentCore Memory (prior invocations, possibly a "
        "different process/cold start):\n" + "\n".join(lines) + "\n\n---\n\n"
    )


def _save_turn(load_id: str, actor_id: str, prompt_text: str, response_text: str) -> None:
    if not (_memory_client and _MEMORY_ID):
        return
    try:
        _memory_client.create_event(
            memory_id=_MEMORY_ID,
            actor_id=actor_id,
            session_id=load_id,
            messages=[(prompt_text, "USER"), (response_text, "ASSISTANT")],
        )
    except Exception as e:
        log.warning(f"AgentCore Memory write failed for load {load_id} (actor {actor_id}): {e}")


def _extract_prompt(payload: dict):
    """Accept validated harness messages, tool results, or a plain prompt string."""
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")
    if "messages" in payload:
        return strip_trailing_tool_use(payload["messages"])
    if "tool_results" in payload:
        tool_results = payload["tool_results"]
        if not isinstance(tool_results, list) or not all(
            isinstance(tool_result, dict) and isinstance(tool_result.get("toolUseId"), str)
            for tool_result in tool_results
        ):
            raise ValueError("tool_results must contain objects with a toolUseId string")
        return [{"role": "user", "content": [{"toolResult": {
            "toolUseId": tr["toolUseId"],
            "status": tr.get("status", "success"),
            "content": tr.get("content", []),
        }} for tr in tool_results]}]
    prompt = payload.get("prompt", "")
    if not isinstance(prompt, str):
        raise ValueError("prompt must be a string")
    return prompt


def _has_inline_function_call(messages) -> bool:
    """Return True if messages contains an assistant toolUse for an inline function tool."""
    if not _INLINE_FUNCTION_NAMES or not isinstance(messages, list):
        return False
    for msg in messages:
        if msg.get("role") == "assistant":
            for block in msg.get("content", []):
                if isinstance(block, dict) and block.get("toolUse", {}).get("name") in _INLINE_FUNCTION_NAMES:
                    return True
    return False


def _is_inline_function_call(event: dict) -> bool:
    """Check if a contentBlockStart event is for an inline function tool."""
    if not _INLINE_FUNCTION_NAMES:
        return False
    cbs = event.get("contentBlockStart", {})
    start = cbs.get("start", {})
    tool_use = start.get("toolUse") if isinstance(start, dict) else None
    return tool_use is not None and tool_use.get("name") in _INLINE_FUNCTION_NAMES



@app.entrypoint
async def invoke(payload, context):
    log.info("Invoking Agent.....")


    session_id = getattr(context, 'session_id', 'default-session')
    agent = get_or_create_agent(session_id)

    prompt = _extract_prompt(payload)
    load_id = _extract_load_id(payload)
    actor_id = _actor_id_for_tenant(_extract_tenant_id(payload))

    # AgentCore Memory continuity: only meaningful for plain-string prompts —
    # a caller-supplied message-history payload already carries its own context.
    effective_prompt = prompt
    if load_id and isinstance(prompt, str):
        prior_context = _load_prior_context(load_id, actor_id)
        if prior_context:
            effective_prompt = prior_context + prompt

    response_text_parts: list[str] = []

    async for event in agent.stream_async(
        effective_prompt,
    ):
        if not isinstance(event, dict) or "event" not in event:
            continue
        cbs = event["event"].get("contentBlockStart")
        if cbs is not None and not cbs.get("start"):
            continue
        delta = event["event"].get("contentBlockDelta", {}).get("delta", {})
        if "text" in delta:
            response_text_parts.append(delta["text"])

        # Save inline, before yielding the terminal event — not after the loop.
        # A live deployment found the SSE consumer stops pulling from this
        # generator once it sees the conversation's final event, so anything
        # placed after `async for` completes is unreachable in production even
        # though it runs fine against a curl client that fully drains the
        # response. stopReason "tool_use" marks an intermediate round trip,
        # not the end of the turn — only save on "end_turn" (or another
        # terminal reason), and only once per invocation.
        stop_reason = event["event"].get("messageStop", {}).get("stopReason")
        if stop_reason and stop_reason != "tool_use" and load_id and isinstance(prompt, str):
            _save_turn(load_id, actor_id, prompt, "".join(response_text_parts))
            load_id = None  # guard against saving twice if another terminal event follows

        yield event

    # Fallback only — normally already saved inline above and load_id is None
    # by now. Covers the rare case the loop runs to completion without a
    # terminal messageStop ever firing.
    if load_id and isinstance(prompt, str):
        _save_turn(load_id, actor_id, prompt, "".join(response_text_parts))


if __name__ == "__main__":
    app.run()

"""Steering — a supervisor that redirects an agent back on track instead of
just blocking it.

The hooks in hooks.py answer yes/no questions (has this run too many times?
did the prerequisite run?). Steering is different: it inspects the actual
*content* of a proposed action and, when it's wrong, doesn't just refuse —
it tells the agent specifically what's wrong and lets it retry correctly in
the same turn. Because BeforeToolCallEvent.cancel_tool becomes the tool's
returned result, the agent sees the feedback as if the tool itself explained
why it wouldn't run, and can redraft. Approve / guide / reject, same three
outcomes as a human supervisor reviewing a colleague's draft before it goes
out — not silent failure, not a hard stop with no explanation.

The checker here is a deterministic rule (regex over the draft message) —
steering doesn't require a second LLM call to be real; it requires the
supervisor to be genuinely separate from, and able to override, the agent
being supervised. A second Agent-as-checker is a valid alternative
implementation of the same pattern for judgment calls a regex can't make
(tone, brand voice) — this one targets a specific, checkable class of
mistake: promising something beyond the linehaul rate, which Carrier
Outreach's system prompt already forbids but — until this hook — nothing
enforced.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Callable

from strands.hooks import BeforeToolCallEvent, HookProvider, HookRegistry


class SteeringVerdict(str, Enum):
    APPROVE = "approve"
    GUIDE = "guide"
    REJECT = "reject"


@dataclass
class SteeringOutcome:
    verdict: SteeringVerdict
    feedback: str | None = None


SteeringChecker = Callable[[dict], SteeringOutcome]


class SteeringHookProvider(HookProvider):
    """Wraps one tool with a supervisor check before it's allowed to execute.

    On APPROVE, the tool runs normally. On GUIDE or REJECT, the tool is
    cancelled and `feedback` becomes the message the agent sees in place of
    a real tool result — specific enough that a reasonable agent can correct
    itself and try again, not just "no."
    """

    def __init__(self, tool_name: str, checker: SteeringChecker):
        self.tool_name = tool_name
        self.checker = checker
        self.last_verdict: SteeringVerdict | None = None

    def register_hooks(self, registry: HookRegistry, **kwargs) -> None:
        registry.add_callback(BeforeToolCallEvent, self._steer)

    def _steer(self, event: BeforeToolCallEvent) -> None:
        if event.tool_use["name"] != self.tool_name:
            return
        outcome = self.checker(event.tool_use.get("input", {}))
        self.last_verdict = outcome.verdict
        if outcome.verdict != SteeringVerdict.APPROVE:
            event.cancel_tool = outcome.feedback or "Steering: this action was not approved."


# Phrases that commit to something beyond the linehaul rate itself — the
# Carrier Outreach Agent's system prompt already says it isn't authorized to
# promise these, but a prompt is a request, not a guarantee. This makes it one.
_OVERREACH_PATTERNS = [
    (re.compile(r"\bguarantee[ds]?\b", re.IGNORECASE), "makes a guarantee"),
    (re.compile(r"\bpromise[ds]?\b", re.IGNORECASE), "makes a promise"),
    (re.compile(r"\bfuture loads?\b", re.IGNORECASE), "references future loads"),
    (re.compile(r"\bno (cap|limit)\b", re.IGNORECASE), "commits to an uncapped term"),
    (re.compile(r"\bunlimited\b", re.IGNORECASE), "commits to an unlimited term"),
    (re.compile(r"\bdetention pay\b", re.IGNORECASE), "commits to accessorial pay (detention)"),
    (re.compile(r"\bsigned agreement\b", re.IGNORECASE), "asserts a binding agreement"),
]


def check_outreach_overreach(tool_input: dict) -> SteeringOutcome:
    """Steering checker for Carrier Outreach's send_rate_offer: the message
    may state the linehaul rate and load details, nothing else."""
    message = str(tool_input.get("message", ""))
    for pattern, reason in _OVERREACH_PATTERNS:
        match = pattern.search(message)
        if match:
            return SteeringOutcome(
                verdict=SteeringVerdict.GUIDE,
                feedback=(
                    f"Steering: this draft {reason} (\"{match.group(0)}\") — you are only authorized "
                    "to negotiate the linehaul rate for this load, nothing else. Redraft the message "
                    "stating only the rate, origin/destination, and equipment, then try again."
                ),
            )
    return SteeringOutcome(verdict=SteeringVerdict.APPROVE)

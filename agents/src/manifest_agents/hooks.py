"""Deterministic governance hooks — real Strands HookProvider implementations,
not prompt instructions the model could ignore.

A system prompt saying "call X before Y" is a request; a hook that cancels Y
until X has actually run is an architectural guarantee. Everything here plugs
into the Strands agent loop at BeforeToolCallEvent (before a tool executes,
can cancel it outright) or AfterToolCallEvent (after a tool executes, to
observe what happened) — see https://strandsagents.com for the full hook
lifecycle. These are new capabilities, not a restatement of the existing
deterministic checks already in this codebase (send_rate_offer's ceiling
check, the Orchestrator's autonomy gate) — those guard *values*; these guard
*behavior* (how many times a tool ran, what order tools ran in).
"""

from collections import defaultdict

from strands.hooks import AfterToolCallEvent, BeforeToolCallEvent, HookProvider, HookRegistry


class RateLimiterHookProvider(HookProvider):
    """Caps how many times each tool may run within a single agent invocation.

    Without this, a confused model can loop-call an external service (FMCSA,
    Textract, a browser-automation tool) indefinitely — costly, slow, and in
    FMCSA's case hitting a real rate-limited public API other users depend
    on. Counts reset per Agent instance, matching this codebase's pattern of
    building a fresh Agent per top-level call.
    """

    def __init__(self, max_calls_per_tool: int = 3):
        self.max_calls_per_tool = max_calls_per_tool
        self._counts: dict[str, int] = defaultdict(int)

    def register_hooks(self, registry: HookRegistry, **kwargs) -> None:
        registry.add_callback(BeforeToolCallEvent, self._check_limit)

    def _check_limit(self, event: BeforeToolCallEvent) -> None:
        name = event.tool_use["name"]
        self._counts[name] += 1
        if self._counts[name] > self.max_calls_per_tool:
            event.cancel_tool = (
                f"Rate limit: {name} has already been called {self._counts[name] - 1} times "
                f"in this session (max {self.max_calls_per_tool}). Refusing to call it again — "
                "work with what you already have, or report that you couldn't complete the "
                "request rather than retrying indefinitely."
            )


class RequireCallFirstHookProvider(HookProvider):
    """Blocks a consequential tool until a prerequisite tool has actually run.

    Enforces procedure order in code, not just in the system prompt. The
    Carrier Outreach Agent's prompt already *says* "confirm load details
    before offering" — this makes it structurally true: send_rate_offer is
    refused, before it ever executes, if get_load_detail hasn't run yet in
    this conversation. A prompt instruction the model could drift from or
    skip under a confusing multi-turn conversation; this cannot be skipped.
    """

    def __init__(self, gated_tool: str, prerequisite_tool: str):
        self.gated_tool = gated_tool
        self.prerequisite_tool = prerequisite_tool
        self._prerequisite_satisfied = False

    def register_hooks(self, registry: HookRegistry, **kwargs) -> None:
        registry.add_callback(AfterToolCallEvent, self._track_prerequisite)
        registry.add_callback(BeforeToolCallEvent, self._enforce_order)

    def _track_prerequisite(self, event: AfterToolCallEvent) -> None:
        if event.tool_use["name"] == self.prerequisite_tool and event.exception is None:
            self._prerequisite_satisfied = True

    def _enforce_order(self, event: BeforeToolCallEvent) -> None:
        if event.tool_use["name"] == self.gated_tool and not self._prerequisite_satisfied:
            event.cancel_tool = (
                f"Refused: {self.gated_tool} requires calling {self.prerequisite_tool} first "
                f"in this conversation, and that hasn't happened yet. Call {self.prerequisite_tool} "
                f"before attempting {self.gated_tool} again."
            )

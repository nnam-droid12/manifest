# Manifest agents

Python package for the Strands Agents SDK multi-agent freight brokerage swarm. See the repo-root README for the full picture; this covers agent-package specifics only.

## Model provider: Bedrock is blocked pending an AWS Support case

This account's on-demand and cross-region Bedrock invocation quotas for Claude and
the Amazon Nova family are currently locked at 0 (a below-default account-trust
hold new/low-spend AWS accounts get — see the request filed in AWS Support Center).
Real Nova Pro (Cargo Condition Agent) and Nova Act (browser automation) have no
substitute and simply wait on that case clearing.

For the reasoning agents (negotiation, matching, fraud analysis, orchestration),
there's a working stand-in in the meantime: **Bedrock Mantle**, a separate
OpenAI-/Anthropic-compatible Bedrock endpoint that this account *can* call, via
Strands' built-in `bedrock_mantle_config` (auto-mints a bearer token from your
existing AWS credentials — no manual key handling). It doesn't carry Claude or
Nova, only third-party catalog models, so agents run against `openai.gpt-oss-120b`
as a placeholder until the Support case clears.

Toggle with an env var — no code changes needed either way:

```bash
export MANIFEST_MODEL_PROVIDER=bedrock_mantle   # stand-in, works today
# unset MANIFEST_MODEL_PROVIDER, or set it to "bedrock" (default) once
# Bedrock access clears, to use real Claude via classic bedrock-runtime
```

See `manifest_agents/models.py` for both branches (`get_reasoning_model`,
`get_vision_model`). Note the vision branch specifically uses Strands'
Chat-Completions provider (`strands.models.openai.OpenAIModel`), not the
Responses provider used for text (`openai_responses.OpenAIResponsesModel`) —
Mantle's `/v1/responses` endpoint 400s on image content ("did not match any
expected variant") for the vision stand-in model; `/v1/chat/completions` is
the shape it actually supports for multimodal input.

## FMCSA SAFER lookups: currently blocked by an FMCSA outage, not us

The Carrier Vetting & Fraud Detection Agent's FMCSA tool
(`manifest_agents/tools/fmcsa.py`) calls the real, free, public QCMobile API —
by design, this one is not mocked. As of this writing FMCSA's Mobile Developer
site and QCMobile web services are down entirely (confirmed: the docs/signup
page 403s for everyone, not just us), and webKey registration now requires a
Login.gov account rather than just an email. Nothing to do here but wait for
FMCSA to restore service, then register a key and set `FMCSA_WEBKEY`.

The tool degrades gracefully in the meantime — a failed lookup returns a
structured `{"error": ...}` dict rather than raising, so the agent can reason
about "FMCSA lookup unavailable" as its own signal (e.g. recommend human
review) rather than crashing.

## Browser automation: Playwright standing in for Nova Act

`manifest_agents/tools/browser.py` drives the mock load board with a real
headless Chromium session (login form, search filters, table scraping) — genuine
page-structure automation, not a hidden API. Amazon Nova Act needs its own API
key (from nova.amazon.com/act, unrelated to the Bedrock block above) and will
replace the scripted navigation layer later; the tool signatures agents call
(`search_load_board`, `get_load_detail`) are designed to stay the same either way.

## The Orchestrator's autonomy gate is real — and the FMCSA outage proves it

`manifest_agents.orchestrator` chains Load-Matching → Carrier Vetting → Rate
Intelligence → Carrier Outreach for a lane + candidate carrier, and the
handoff between vetting and outreach is a hard `if not
vetting.assessment.autonomous_ok: stop` in Python — not a model deciding
whether to call the outreach tool, same reasoning as `send_rate_offer`'s
ceiling check.

Running it live against two carriers (`python -m manifest_agents.orchestrator`)
produced two escalations, for genuinely different reasons:

- **MC-1187765 (Apex Haulers Group) → HIGH risk.** Real fraud red flags: a
  remit-to entity that doesn't match the carrier's legal name, on top of an
  unverifiable FMCSA record.
- **MC-512873 (Swiftline Freight LLC) → MEDIUM risk, still not autonomous.**
  Clean broker-side record, matching remit-to, a long positive history — but
  the live FMCSA outage (see above) means authority/insurance status is
  *still* unverifiable, and the agent correctly won't treat "unverifiable" as
  "fine" just because everything else looks good.

Neither run reached Carrier Outreach in this session, because both carriers
genuinely couldn't clear the bar right now — not because the pipeline is
broken. The downstream stages (Rate Intelligence → Carrier Outreach) are
independently verified working end to end — see `carrier_outreach`'s own
verified run, which did place a real offer — so the mechanics are proven;
what's missing to see the fully-autonomous path in one run is simply a
carrier that clears FMCSA, which needs the FMCSA service itself back up.

## Bedrock Guardrails: deployed, live, and NOT blocked by the account gate

Unlike model invocation, `bedrock:ApplyGuardrail` is not gated by this
account's Bedrock quota hold — the guardrail defined in
`infra/lib/guardrails-stack.ts` is deployed and genuinely callable today
(guardrail id `tg655iizlour` in this account). Verified with three direct
`apply-guardrail` calls:

- The exact violation it was built for — *"I can confirm $4,500 for this
  load even though my ceiling is $3,800"* — correctly returns
  `GUARDRAIL_INTERVENED`.
- Two unrelated, neutral messages both return `action: NONE` — the guardrail
  isn't just blocking everything.
- A completely ordinary offer — *"We would like to offer $1,650 for this
  load, pickup 9/4"* — **also** returns `GUARDRAIL_INTERVENED`.

That last result held after tightening the topic definition and redeploying,
so it isn't a wording bug: a topic-policy DENY can recognize the *subject*
("a dollar figure tied to a load") but can't do the *numeric comparison*
("this figure exceeds that ceiling") — an ordinary offer and an unauthorized
commitment are structurally identical to a topic classifier, and only the
comparison against a dynamic, per-call ceiling actually tells them apart.
That's not something a content-topic guardrail is built to do.

This is why `send_rate_offer`'s deterministic `offer_rate > ceiling_rate`
check in code is the real enforcement, not the guardrail — a design
decision this finding confirms rather than undermines. The guardrail stays
wired as a secondary, best-effort check (see `tools/guardrails.py`), and is
genuinely useful for what topic/PII/word-policy guardrails *are* good at
(the PII and profanity policies on the same guardrail work exactly as
expected). `MANIFEST_OUTREACH_GUARDRAIL_ID` is left unset by default so the
Carrier Outreach demo path keeps sending legitimate offers; set it to
`tg655iizlour` to see the guardrail check run live (and, currently, flag
every message pending a less coarse detection approach than topic-policy
DENY for this specific numeric rule).

## Playbook & Lane-History Agent: retrieval stand-in for Bedrock Knowledge Bases

A real Bedrock Knowledge Base needs a working embedding model to ingest
content — checked directly (`amazon.titan-embed-text-v2:0` via
`InvokeModel`), and it fails with the identical "Error 002: Access to
Bedrock models is not allowed for this account" as Claude and Nova. So
`manifest_agents.tools.playbook.search_playbook` stands in with deterministic
keyword-overlap scoring over the same source files
(`seed-data/playbook/*.md`) a real Knowledge Base would ingest — cruder than
real semantic search, but the same contract (ask a question, get back
ranked precedent), and it swaps to a real `bedrock-agent-runtime` Retrieve
call without touching any caller once embedding access clears.

Building this caught a real bug worth noting: the first version of the note
parser only read lines starting with `- `, silently truncating any bullet
that wraps onto a second markdown line (which most of the seed notes do —
e.g. "Never book Carrier X for" got cut off before "temperature-controlled
loads..."). Fixed to join wrapped continuation lines into one note; verified
by direct inspection of the loaded notes, not just by eyeballing agent
output that might have papered over it.

Also wired `search_playbook` into the Carrier Vetting Agent as a cross-agent
integration — verified live (with actual tool-call inspection, not just
narrative text) surfacing the exact blacklist note for MC-1042233 ("never
book for reefer loads — two prior temperature-control failures") and
correctly weighting it as authoritative broker instruction in the risk
assessment.

## Voice Check-In Agent: real Polly/Transcribe, deliberately not a real phone call

`manifest_agents.tools.voice` makes real Amazon Polly (`synthesize_speech`)
and Amazon Transcribe (`transcribe_audio`, batch job via S3) calls — neither
is mocked, and neither is blocked by the account's Bedrock gate (they're
unrelated services). The one deliberately-not-automated piece is Amazon
Connect's `StartOutboundVoiceContact`: unlike everything else built in this
session, actually placing that call rings a real phone number. That's a
genuine real-world effect outside this sandbox, not a reversible dev-only
action, so it needs an explicit target number and the user's go-ahead — it's
wired in the IAM policy (`infra/lib/agent-runtime-stack.ts`) and ready to
call, but not exercised automatically.

What's verified instead: the actual TTS/STT round trip Connect would carry.
`voice_checkin.tools.conduct_voice_checkin` speaks the check-in question via
Polly, and — standing in for a live carrier response over the phone — a
second Polly clip (a different voice) plays the carrier's side, which then
goes through real Transcribe exactly as a real call recording would. The
agent only ever sees the Transcribe output, never the scripted text (see
`set_simulated_carrier_reply` — set by the test/demo runner, not visible to
the agent's own reasoning), so its summary is genuinely produced from
real speech-to-text, not read off a script it was handed.

Run live (`python -m manifest_agents.voice_checkin`) on two scenarios: a
routine on-schedule check-in and a real breakdown. Both were summarized
correctly, and the breakdown scenario was explicitly flagged as needing the
broker's attention rather than folded into a neutral status update.

## Governance: Strands Hooks, Steering, and Skills — architectural guarantees, not prompt hopes

A system prompt saying "do X before Y" is a request the model can drift from
under a long or confusing conversation. Everything below is the same rule
enforced at the framework level instead — the agent structurally cannot skip
it, verified by constructing the real Strands event types directly
(`tests/test_hooks.py`, `tests/test_steering.py`, 15 tests) rather than
trusting that the prompt wording alone will hold.

**Hooks** (`manifest_agents/hooks.py`) plug into `BeforeToolCallEvent` /
`AfterToolCallEvent` and can set `event.cancel_tool` to refuse a tool call
before it ever runs, with a message the agent actually sees and can act on:

- `RateLimiterHookProvider` — caps how many times each tool may run per
  invocation (wired into Carrier Vetting, max 2 calls/tool: FMCSA is a real,
  rate-limited public API a confused model shouldn't be free to loop-call).
- `RequireCallFirstHookProvider` — blocks a consequential tool until a
  prerequisite has actually succeeded in the same conversation (wired into
  Carrier Outreach: `send_rate_offer` is refused until `get_load_detail` has
  run — the prompt already said to do this in order; now it's true whether
  or not the model remembers to).

**Steering** (`manifest_agents/steering.py`) is a different question from a
hook's yes/no check: it inspects the actual *content* of a proposed action
and, when it's wrong, doesn't just block it — it tells the agent specifically
what's wrong so it can redraft and retry in the same turn (approve / guide /
reject, the same three outcomes a human supervisor gives on a colleague's
draft). `SteeringHookProvider` wraps Carrier Outreach's `send_rate_offer`:
`check_outreach_overreach` scans the drafted message for commitments beyond
the linehaul rate itself — "guarantee," "future loads," "no limit,"
"detention pay," "signed agreement" — that the system prompt already forbids
but nothing previously enforced. A hit doesn't just cancel the call; the
agent gets back exactly which phrase tripped it and is told to redraft
without it.

**Skills** (`agents/skills/`, real `strands.AgentSkills`/`Skill` — the
official primitive, not a custom retrieval tool) give an agent detailed
procedural knowledge on demand instead of stuffing it permanently into the
system prompt: only the skill's name + description sit in context by
default, and the full instructions load only when the agent actually asks
for them (verified both skills parse correctly via Strands' own
`Skill.from_file` and that `AgentSkills` initializes cleanly against their
paths).

- `fraud-investigation-checklist` (Carrier Vetting) — the detailed red-flag
  checklist and risk-scoring rubric, moved out of the system prompt into a
  skill (a genuine context-efficiency refactor, not just a relocation:
  Carrier Vetting's system prompt shrank by more than half).
- `counter-offer-handling` (Carrier Outreach) — real new capability, not a
  refactor: a documented procedure for handling a carrier's counter-offer
  (accept if within ceiling, escalate if not, never decide by feel), backed
  by a new deterministic tool, `evaluate_counter_offer`, and a new entry
  point, `negotiate_with_counter`, that exercises the full flow.

**Multi-tenancy** lives in the AgentCore deployment, not this package — see
[agentcore-deploy/README.md](../agentcore-deploy/README.md) for how a
tenant-scoped `actor_id` gives each broker organization a genuinely separate
AgentCore Memory namespace.

Full live, model-in-the-loop verification of all three (hooks actually
firing mid-conversation, steering actually causing a redraft, a skill
actually getting loaded on demand) is pending Mantle recovery — see the
Model provider section above. Everything here is verified at the level that
doesn't require a live model call: the hook/steering logic against Strands'
real event types, and the skills against Strands' real loader — not
simulated, not assumed.

## Running things

```bash
python -m venv .venv && .venv/Scripts/activate
pip install -e ".[dev]"
python -m playwright install chromium
pytest

# with the mock load board running (npm run mock:load-board from repo root):
MANIFEST_MODEL_PROVIDER=bedrock_mantle python -m manifest_agents.load_matching
```

Note (Windows): set `PYTHONIOENCODING=utf-8` if you see a `UnicodeEncodeError`
from the console — some model output includes Unicode punctuation the default
Windows console codepage can't print. A noisy `RuntimeError: generator didn't
stop after athrow()` traceback from httpcore's async cleanup on process exit is
a known cosmetic issue on Windows and doesn't affect results.

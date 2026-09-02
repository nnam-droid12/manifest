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

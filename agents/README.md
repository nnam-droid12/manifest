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

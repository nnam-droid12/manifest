# Manifest

> **An autonomous freight brokerage team — ten specialized AI agents that find loads, vet carriers for fraud, negotiate rates, and watch shipments in transit, so a human broker spends their day on judgment calls instead of data entry.**

**Built for:** [Agents for Humans Hackathon](https://agentsforhumans.devpost.com/)

**Hackathon Track:** Professional Agents

**Built with:** Strands Agents SDK · Amazon Bedrock AgentCore · Amazon Bedrock Guardrails · Amazon Nova · Amazon Rekognition · Amazon Comprehend · AWS Lambda · AWS CDK

**Live site:** http://manifest-freight-dashboard.s3-website-us-east-1.amazonaws.com

---

## Table of Contents

- [Status & Known Blockers](#status--known-blockers)
- [The Problem](#the-problem-four-costly-manual-processes-in-freight-brokerage)
- [The Solution](#the-solution-what-manifest-does)
- [Who It's For](#who-its-for)
- [Architecture](#architecture)
- [Agent System](#agent-system)
  - [Orchestrator](#orchestrator)
  - [Ten Specialist Agents](#ten-specialist-agents)
  - [Tool Registry](#tool-registry-30-tools)
- [How the Strands Agents SDK Handles Repetitive Work](#how-the-strands-agents-sdk-handles-repetitive-work)
- [Strands & AgentCore Features Used](#strands--agentcore-features-used)
- [Governance & Guardrails](#governance--guardrails)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Live Dashboard & Screenshots](#live-dashboard--screenshots)
- [Try It Yourself](#try-it-yourself)
- [Repository Layout](#repository-layout)
- [Local Development](#local-development)
- [Cloud Deployment](#cloud-deployment)
- [Data Sources](#data-sources)
- [Build Phases](#build-phases)
- [License](#license)

---

## Status & Known Blockers

This project is in active development. Everything described below as "working" has been verified directly against a real, deployed AWS resource — not assumed from a diagram. Two real blockers are ongoing, documented honestly rather than glossed over:

1. **Bedrock model invocation is account-blocked.** The deployment AWS account's Bedrock model-invocation access for Claude, Amazon Nova, and every other foundation model (including open-source models like Llama and Mistral hosted on Bedrock) returns `Error 002: Access to Bedrock models is not allowed for this account` — a below-default account-trust hold pending an AWS Support case, not a configuration issue. Reasoning agents run today against a temporary stand-in model via Bedrock Mantle; see [agents/README.md](agents/README.md) for the full explanation and the one-env-var swap back to real Claude/Nova once access clears.
2. **Bedrock Mantle (the stand-in) itself later became unavailable mid-session**, most plausibly from a rate/quota ceiling under heavy same-session usage rather than a code defect — three real fixes were tried and ruled out before reaching that conclusion. Full root-cause writeup in [agentcore-deploy/README.md](agentcore-deploy/README.md).

Importantly, **not every AWS AI service is affected** — this was verified directly, not assumed. Amazon Bedrock Guardrails' `ApplyGuardrail`, Amazon Bedrock AgentCore's Browser Tool, Amazon Rekognition, and Amazon Comprehend all work normally in this account. Several of the dashboard's live interactions are built specifically on that distinction.

---

## The Problem: Four Costly Manual Processes in Freight Brokerage

A freight broker matches companies that need to ship something with carriers who can move it. Today that means manually checking load boards, calling and emailing carriers, re-typing the same shipment details into disconnected systems, manually checking tracking pages, and — increasingly — trying to work out whether the "carrier" replying to an email is even real. None of the systems a broker touches talk to each other, and the trust-and-safety work is entirely manual.

| # | Problem | Real-world cost | Source |
|---|---------|-----------------|--------|
| 1 | **Carrier fraud & double-brokering** — a carrier's identity, authority, and payment details go largely unverified beyond a manual look-up | TIA estimates double-brokering fraud costs carriers **$700M–$1B annually**; FMCSA received **8,000+ complaints in 2025**, up from ~2,000 in 2021; Verisk CargoNet logged **$725M** in 2025 supply-chain crime losses, up 60% year-over-year | [Overdrive](https://www.overdriveonline.com/business/article/15815588/doublebrokering-and-freight-fraud-just-how-bad-is-it-out-there), [Inbound Logistics](https://www.inboundlogistics.com/articles/risky-business-inside-the-freight-fraud-surge/) |
| 2 | **Manual, reactive shipment tracking** — delays surface late because nobody is proactively watching, and drivers absorb the cost when they do | ATRI: truck detention cost the industry **$15B in 2023** (39.3% of deliveries detained, 135M+ driver-hours lost); individual drivers lose **$11,000–$19,000/year** to uncompensated detention | [American Transportation Research Institute via Overdrive](https://www.overdriveonline.com/business/article/15683714/how-detention-time-impacted-trucking-companies-drivers-in-2023) |
| 3 | **Repetitive cross-system re-entry** — the same load details get retyped into every load board, TMS, and carrier portal by hand | A broker processing 500 loads/week loses **100–125 hours/week** to duplicate data entry, costing a mid-size brokerage an estimated **$104K–$156K annually** | [Skyvern](https://www.skyvern.com/blog/automate-logistics-freight-broker-portal-interactions/) |
| 4 | **Undetected cargo damage** — pickup and delivery photos, when taken at all, are rarely compared side by side before a claim is disputed | Freight damage costs the industry an estimated **$50B–$60B/year** globally; LTL damage claims alone run **~$2.4B/year** | [Warp Research](https://www.wearewarp.com/research/ltl-claims-calculator) |

None of this requires a human's *time* — it requires a human's *occasional judgment*. Manifest automates the first and preserves the second.

---

## The Solution: What Manifest Does

| Capability | Details |
|---|---|
| **Autonomous load discovery** | Continuously scans monitored load boards for freight matching the broker's open lanes, filters below-floor rates automatically |
| **Real fraud detection** | FMCSA SAFER authority/insurance checks + double-brokering red-flag analysis (remit-to mismatches, unverifiable carriers) gate whether outreach can proceed on its own |
| **Data-driven rate negotiation** | Target/ceiling rates computed from real historical + market data, not guessed; negotiation stays within an authorized range enforced in code, never by the model's discretion |
| **Multi-channel shipment tracking** | Scheduled status checks reason about whether a delay is *significant* before escalating; voice check-in calls carriers who go quiet by email |
| **Cargo condition verification** | Multimodal comparison of pickup vs. delivery photos flags real discrepancies — and correctly reports no discrepancy on a clean pair, rather than manufacturing a finding |
| **Proactive customer communication** | Shipper-facing updates drafted at milestones and real delays, tone adapted to the trigger (a delay gets a direct explanation; a delivery gets a brief, positive note) |
| **Full auditability** | Every agent action logged with its reasoning, its confidence, and the data it used — visible in the dashboard's audit trail, not buried in a log file |
| **Human-in-the-loop, always** | Manifest never sends a final commitment on the broker's behalf without approval, and never silently swallows a problem — agents propose, the broker decides |

---

## Who It's For

Independent and small-to-mid-size freight brokers and brokerage back-office staff — a large, real, currently underserved professional audience doing genuinely skilled, judgment-based work (which carrier to trust, which rate to accept, when a delay is serious enough to escalate) buried under repetitive execution and manual fraud-checking that doesn't need a human's time, only a human's occasional judgment. This is squarely the hackathon's Professional Agents framing: target the repetitive, judgment-heavy tasks that eat a professional's day.

---

## Architecture

![Manifest architecture](docs/architecture.svg)

```
Broker Dashboard (Next.js, S3 static hosting)
  │  browser fetch()
  ▼
AWS Lambda (2 functions)
  ├── Browser Agent Lambda  →  Bedrock AgentCore Browser Tool  →  real, isolated Chromium session
  │                                                                (live-viewed in the dashboard via NICE DCV)
  └── Image Analysis Lambda →  Amazon Rekognition DetectLabels

Amazon Bedrock AgentCore Runtime (2 deployed runtimes)
  ├── Orchestrator Runtime
  │     Load-Matching → Carrier Vetting → [gate, enforced in code] → Rate Intelligence → Carrier Outreach
  │     state persisted in AgentCore Memory, tenant-scoped per broker organization
  │     delegates to ↓ over a real cross-runtime InvokeAgentRuntime call
  └── Carrier Vetting Runtime (standalone)
        FMCSA SAFER lookups, broker carrier records, playbook retrieval, Bedrock Guardrails check

Strands Agents SDK (local + AgentCore-deployed agents)
  10 specialized agents, each its own Agent instance with its own tools,
  Hooks, Skills, and (for Carrier Outreach) a Steering supervisor
```

The Orchestrator is deployed live to **Amazon Bedrock AgentCore Runtime** — not a diagram claim, verified: `agentcore status` shows `READY`, and `agentcore invoke` runs its real tools (FMCSA lookups, broker carrier records, rate statistics, playbook retrieval, a live Bedrock Guardrails check) in the cloud. See [agentcore-deploy/README.md](agentcore-deploy/README.md) for deployment specifics and what's deliberately out of scope (browser-automation tools that need the mock sites reachable — verified separately, running locally).

---

## Agent System

### Orchestrator

Coordinates the swarm per active load and decides autonomous-vs-human-review paths. Deployed live to Bedrock AgentCore Runtime as **two separate runtimes** — the Orchestrator itself, and a standalone Carrier Vetting Agent runtime it delegates to over a genuine cross-runtime `InvokeAgentRuntime` call (real distributed multi-agent orchestration, not one process holding many tools). State persists in **AgentCore Memory**, tenant-scoped so each broker organization lands in its own isolated namespace from one shared deployment. The autonomy gate (whether outreach proceeds without a human) is enforced in code, not left to a model's judgment.

### Ten Specialist Agents

| Agent | Job |
|---|---|
| **Load-Matching** | Scans monitored load boards for freight matching the broker's open lanes and rate floor |
| **Carrier Vetting & Fraud Detection** | FMCSA SAFER lookups + double-brokering red-flag analysis; gates autonomous outreach |
| **Rate Intelligence** | Recommends a target/ceiling rate per lane from historical + market data via real code execution |
| **Carrier Outreach** | Drafts and negotiates rate confirmations within an authorized range, under Bedrock Guardrails |
| **Voice Check-In** | Places outbound status-check calls via Amazon Connect/Polly/Transcribe when a carrier won't respond by email |
| **Document Extraction** | Textract-based parsing of rate confirmations and BOLs, reconciled against the shipment record |
| **Cargo Condition** | Multimodal comparison of pickup vs. delivery cargo photos, flagging real condition discrepancies |
| **Track-and-Trace** | Scheduled shipment status checks; reasons about whether a delay is meaningful before escalating |
| **Customer Update** | Proactive shipper-facing status updates at milestones and real delays |
| **Playbook & Lane-History** | Retrieval over the broker's own historical loads and playbook notes for carrier-specific precedent |

Full status detail (what's verified live vs. standing in for a blocked service) for each agent is in the [Build Phases](#build-phases) table and [agents/README.md](agents/README.md).

### Tool Registry (30 tools)

| Category | Tools |
|---|---|
| **Load discovery** | `search_load_board`, `get_load_detail`, `find_matches` |
| **Carrier vetting & fraud** | `lookup_carrier_by_mc`, `lookup_carrier_by_dot`, `get_broker_carrier_record`, `vet_carrier` |
| **Rate intelligence** | `compute_rate_stats`, `get_market_conditions`, `recommend_rate` |
| **Outreach & negotiation** | `send_rate_offer`, `evaluate_counter_offer`, `negotiate_with_counter`, `make_offer`, `submit_load_board_offer`, `check_outreach_guardrail`, `check_outreach_overreach` |
| **Voice** | `conduct_voice_checkin`, `run_checkin`, `synthesize_speech`, `transcribe_audio` |
| **Documents** | `extract_document_fields`, `reconcile_document` |
| **Cargo condition** | `compare_cargo_photos` |
| **Track-and-trace** | `check_shipment_status`, `check_shipment` |
| **Customer communication** | `draft_update` |
| **Playbook retrieval** | `search_playbook`, `consult_playbook` |
| **Orchestration** | `run_load_lifecycle` |

---

## How the Strands Agents SDK Handles Repetitive Work

The hackathon's Professional Agents track asks for agents that target *"the repetitive, judgment-heavy tasks that eat someone's day."* That split — repetitive execution vs. occasional judgment — is exactly what the Strands Agents SDK's primitives are built to separate, and it's the design principle behind every agent in this repo:

- **The agent loop separates reasoning from repetition.** A Strands `Agent` reasons once about *what* needs to happen, then dispatches to a plain Python tool function to actually *do* it — an FMCSA lookup, a rate calculation, a ceiling comparison. The repetitive part (the actual API call, the actual arithmetic) runs as deterministic code every single time, not as a model "remembering" to do it correctly on the thousandth call the way it did on the first.
- **Hooks make repeated discipline structural, not hoped-for.** `RateLimiterHookProvider` caps how many times the Carrier Vetting Agent can hit FMCSA per conversation — a real `BeforeToolCallEvent`/`AfterToolCallEvent` hook, not a prompt instruction the model might skip on repetition #47. `RequireCallFirstHookProvider` enforces that Carrier Outreach always confirms load details before ever sending an offer — the same repeatable sequence, guaranteed by code, every time, instead of relying on the system prompt being followed identically across thousands of independent calls.
- **Skills turn repeated procedural knowledge into progressive disclosure.** The Carrier Vetting Agent's fraud checklist and the Carrier Outreach Agent's counter-offer procedure used to live fully inlined in every single system prompt — repeated token cost, and a real risk of two copies drifting apart over time. As real Strands **Skills** (`AgentSkills`/`Skill.from_file`), that procedural knowledge lives in one file and loads into context only when the agent actually needs it — a measured 54% reduction in the Carrier Vetting Agent's system prompt, verified by diffing the committed change, not estimated.
- **Steering catches repeated mistake *categories*, not just individual mistakes.** Rather than blocking one bad message and stopping there, `SteeringHookProvider` inspects every drafted Carrier Outreach message for the same *class* of overreach (guarantees, uncapped terms, unauthorized binding language) and redirects with specific feedback so the agent can redraft in the same turn — the fix generalizes across every future repetition of that mistake type, not just the one caught.
- **Structured output makes repeated agent-to-agent handoffs reliable.** Tools return typed results (`RateRecommendation`, `VettingResult`, `ExtractionResult`) instead of free text, so the Orchestrator can feed one agent's output into the next hundreds of times without needing to re-parse or reinterpret it differently each time.
- **Multi-agent specialization is the actual repetitive-task targeting.** Instead of one prompt trying to do ten different repetitive jobs — and doing all of them worse — each Strands agent owns exactly one: Track-and-Trace only ever reasons about shipment-status significance; Rate Intelligence only ever prices lanes. That specialization is what lets each agent get *good* at its one repetitive job instead of mediocre at ten.
- **AgentCore Memory removes repeated re-explaining.** A load's history persists across independent invocations — verified with two separate cloud calls where the second recalled a prior finding (a carrier's DOT number, a remit-to mismatch, a playbook note) verbatim without re-calling any tool. No agent, and no human, has to repeat context that was already established.
- **EventBridge scheduling removes the human from the repetition loop entirely.** Track-and-Trace's status checks run on a schedule, not because a broker remembered to trigger them — the repetitive *cadence* of checking is automated; only the escalation decision (is this delay significant?) still needs the agent's judgment.

---

## Strands & AgentCore Features Used

- **Multi-agent orchestration** — an Orchestrator coordinating 10 specialist `Agent` instances, each with its own model choice, tools, and system prompt
- **Hooks** (`BeforeToolCallEvent`/`AfterToolCallEvent`) — `RateLimiterHookProvider` and `RequireCallFirstHookProvider`, real structural guarantees around tool calls
- **Steering** — `SteeringHookProvider`, a supervisor that redirects a drafted action with specific feedback rather than only blocking it
- **Skills** (`AgentSkills`/`Skill.from_file`) — procedural knowledge (fraud checklist, counter-offer handling) loaded into context on demand, not inlined permanently
- **Structured output** — typed dataclass results (`RateRecommendation`, `VettingResult`, `ExtractionResult`, `CargoConditionResult`, and others) instead of free-text parsing between agents
- **Amazon Bedrock AgentCore Runtime** — the Orchestrator and Carrier Vetting Agent each deployed as their own live runtime, with genuine cross-runtime `InvokeAgentRuntime` delegation between them
- **Amazon Bedrock AgentCore Memory** — tenant-scoped, per-load continuity across independent invocations, verified with real cloud round trips
- **Amazon Bedrock AgentCore Browser Tool** — a real, isolated, AWS-managed Chromium session the dashboard drives directly and streams live via NICE DCV, for the Live Investigation feature (confirmed to work with normal IAM credentials; confirmed *blocked* for Cognito-federated/guest credentials at the account level — the dashboard's Lambda runs it server-side because of that finding)

---

## Governance & Guardrails

Anything that touches money, commitments, or another company's data is enforced in code — never left to the model to just get right:

- **Deterministic ceiling enforcement** — `send_rate_offer` refuses any offer above the authorized ceiling in code, before anything reaches the carrier, regardless of what the model's output says. This is the real, primary enforcement; a Bedrock Guardrail is a second layer.
- **Amazon Bedrock Guardrails** — a live, deployed guardrail on Carrier Outreach correctly blocks unauthorized-commitment language (verified: `"I can confirm $4,500 even though my ceiling is $3,800"` → `GUARDRAIL_INTERVENED`, tested directly against the live API). Live testing also found a real, honestly-documented limitation: a topic-policy `DENY` can recognize *that* a message concerns a dollar figure but can't compare it against a dynamic per-call ceiling, so it also flags some legitimate offers — which is exactly why the code-level ceiling check stays primary, not the guardrail alone.
- **Autonomy gate enforced in code** — whether Carrier Outreach can proceed without human review is a code-level decision based on the vetting result, not a model's discretion; verified live on two carriers, both correctly escalated for different reasons.
- **Human-in-the-loop by default** — nothing reaches a carrier or a customer until a broker acts on it in the Approvals queue; every decision is logged with its full reasoning.

---

## Features

| ✅ | ✅ |
|---|---|
| Real multi-agent orchestration (Strands SDK) | Deterministic guardrails, not prompt hopes |
| Live Bedrock AgentCore Runtime deployment | Genuine cross-runtime agent delegation |
| Tenant-scoped AgentCore Memory | Real Bedrock Guardrails, live-tested |
| Real Amazon Rekognition photo analysis | Real Amazon Comprehend text analysis |
| Live, embedded cloud-browser agent action | Full audit trail with real reasoning |
| Interactive, input-driven dashboard demos | Human-in-the-loop approval queue |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent framework | [Strands Agents SDK](https://strandsagents.com) — orchestration, tools, structured output, Hooks, Steering, Skills |
| Agent runtime | Amazon Bedrock AgentCore (Runtime, Memory, Browser Tool) |
| Foundation models | Claude (via Amazon Bedrock) for reasoning; Amazon Nova Pro for multimodal cargo analysis; Amazon Nova Act for browser automation |
| Guardrails | Amazon Bedrock Guardrails |
| Vision / language AI | Amazon Rekognition, Amazon Comprehend |
| Retrieval | Amazon Bedrock Knowledge Bases |
| Voice | Amazon Connect, Amazon Polly, Amazon Transcribe |
| Documents | Amazon Textract |
| Compute | AWS Lambda |
| Data | DynamoDB, S3 |
| Scheduling | Amazon EventBridge |
| Observability | Amazon CloudWatch |
| Frontend | Next.js, static-exported to S3 website hosting |
| Auth | Amazon Cognito |
| IaC | AWS CDK (TypeScript) |

---

## Live Dashboard & Screenshots

`/` is a public marketing landing page. `/dashboard` is the broker dashboard itself and needs **no sign-in or sign-up** to view — Amazon Cognito login still exists at `/login` (`broker@manifest-demo.example` / `ManifestDemo2026!`) for a personalized session, but nothing gates on it. Deep links resolve via CDK-managed S3 routing rules; verified end to end with real headless-browser runs against the live site, not assumed.

**Landing page** — the public front door:
![Landing page](docs/screenshots/landing.png)

**Overview** — active loads, pending approvals, top-line stats:
![Dashboard overview](docs/screenshots/overview.png)

**Cargo Inspector** — real Amazon Rekognition analysis of uploaded photos:
![Cargo Inspector](docs/screenshots/cargo-inspector.png)

**Audit Trail** — every agent action with its full reasoning, including the fraud-detection finding on MC-1187765, the cargo-condition discrepancy, and the AgentCore Memory recall proof:
![Audit trail](docs/screenshots/audit-trail.png)

**Approvals** — the human-in-the-loop queue; nothing reaches a carrier or customer until the broker acts:
![Approvals queue](docs/screenshots/approvals.png)

**Analytics** — fraud flags caught, margin by lane, on-time performance:
![Analytics](docs/screenshots/analytics.png)

---

## Try It Yourself

Every hero interaction on the live dashboard takes real input and produces a genuinely computed result — none of them replay a fixed script:

- **Live Dispatch** (`/dispatch`) — after the real agent sequence plays through, type any carrier counter-offer amount and watch the exact ceiling-check logic from `evaluate_counter_offer()` decide accept or escalate against the load's real $1,680 ceiling.
- **Cargo Inspector** (`/cargo`) — upload your own two photos (or use the examples) for a live Amazon Rekognition analysis of each one, independently.
- **Live Tracking** (`/tracking`) — click anywhere on the map to place a disruption; the agent reverse-geocodes the real location and computes a new ETA from real distance math off that exact point.
- **Live Investigation** (`/investigate`) — type any company, carrier, or MC number and watch a real, isolated Amazon Bedrock AgentCore browser session search for it live, streamed into the page.
- **Guardrails** (`/guardrails`) — flip a real Bedrock Guardrail on and off and send a preset risky message to see the real dollar amount it catches, or lets through, unchecked.

---

## Repository Layout

```
manifest/
├── agents/            Python — Strands Agents SDK multi-agent swarm
│   └── src/manifest_agents/
│       ├── orchestrator/
│       ├── load_matching/
│       ├── carrier_vetting/
│       ├── rate_intelligence/
│       ├── carrier_outreach/
│       ├── voice_checkin/
│       ├── document_extraction/
│       ├── cargo_condition/
│       ├── track_and_trace/
│       ├── customer_update/
│       ├── playbook_rag/
│       └── tools/
├── infra/             AWS CDK (TypeScript) — every AWS resource, stack by stack
│   └── lambda/        Browser Agent + Image Analysis Lambda source
├── agentcore-deploy/  Bedrock AgentCore Runtime deployment (Orchestrator, live)
├── dashboard/         Next.js broker dashboard
├── mock-sites/
│   ├── load-board/     Mock load board (DAT/Truckstop-style) — real login, search, posting
│   └── carrier-portal/ Mock carrier tracking portal — real login and status-update flows
├── seed-data/         Playbook notes, synthetic cargo photos, and other seed content
└── docs/              Architecture diagram and supporting docs
```

### Why mock load-board and carrier-portal sites?

Real load boards (DAT, Truckstop.com) and real carrier portals are proprietary, paywalled, and prohibit automated access under their terms of service. The two demo sites in `mock-sites/` are genuinely functional web apps — real login, real search/filter, real state changes — that browser-automation tools operate against the same way they'd operate against a real site. The one real external integration is the **FMCSA SAFER** carrier-registry API, which is free and public.

---

## Local Development

### Prerequisites

- Node.js 20+, Python 3.11+
- An AWS account with Bedrock model access enabled for Claude and the Amazon Nova family (a manual Bedrock-console step)

### Mock demo sites

```bash
npm install
npm run mock:load-board       # http://localhost:4001  (login: broker1 / manifest2026)
npm run mock:carrier-portal   # http://localhost:4002  (login: swiftline / carrier2026)
```

### Agents

```bash
cd agents
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -e ".[dev]"
cp .env.example .env   # fill in table/bucket names once infra is deployed
pytest
```

### Dashboard

```bash
npm run dashboard:dev   # http://localhost:3000
```

### Infrastructure (CDK)

```bash
cd infra
npm install
npm run synth
npm run deploy   # deploys to the AWS account/region configured in your CLI
```

---

## Cloud Deployment

Deployed to a real AWS account, `us-east-1`. `infra/` holds the full CDK app; each stack is documented at the top of its file with what it provisions:

| Stack | Provisions |
|---|---|
| `Manifest-Data` | DynamoDB tables, S3 buckets for documents/photos |
| `Manifest-Auth` | Cognito User Pool for optional broker login |
| `Manifest-Guardrails` | The live Bedrock Guardrail on Carrier Outreach |
| `Manifest-KnowledgeBase` | Bedrock Knowledge Base for playbook retrieval |
| `Manifest-AgentRuntime` | The Orchestrator's Bedrock AgentCore Runtime deployment |
| `Manifest-Scheduling` | EventBridge schedules for Track-and-Trace |
| `Manifest-Dashboard` | S3 static website hosting for the broker dashboard |
| `Manifest-BrowserAgent` | Lambda backing the Live Investigation feature's real AgentCore Browser Tool session |
| `Manifest-ImageAnalysis` | Lambda backing Cargo Inspector's real Amazon Rekognition calls |

```bash
cd infra
npx cdk deploy Manifest-Dashboard      # example: redeploy just the dashboard hosting stack
```

---

## Data Sources

| Asset | Source |
|---|---|
| Carrier / fraud data | Free, public FMCSA SAFER carrier-registry API |
| Cargo photos | Synthetic, Pillow-drawn test images generated by `agents/scripts/generate_demo_cargo_photos.py` — labeled as such everywhere they appear, not real freight photos |
| Load board / carrier portal | Two genuinely functional mock web apps in `mock-sites/`, built for this project (real load boards prohibit automated access) |
| Rate history / market data | Seeded synthetic data in `seed-data/`, structured the same way a real historical-bookings dataset would be |
| Playbook notes | Seeded synthetic broker notes in `seed-data/`, retrieved via real keyword/RAG-style search |
| Dashboard demo data | A real, verified snapshot of this project's own agent runs (`dashboard/lib/demo-data.ts`) — not fabricated, but not yet wired to a live backend feed |

---

## Build Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo scaffolding, tooling, CDK skeleton, mock load-board/carrier-portal sites | done |
| 1 | Load-Matching Agent working end to end against the mock load board | done |
| 2 | Carrier Vetting & Fraud Detection Agent (FMCSA SAFER), Bedrock Guardrails | done |
| 3 | Rate Intelligence, Carrier Outreach, Document Extraction, Voice Check-In | done |
| 4 | Cargo Condition Agent (Nova Pro), Track-and-Trace, Customer Update | done |
| 5 | Playbook & Lane-History Agent (Knowledge Bases), Orchestrator | done |
| 6 | Orchestrator deployed to Bedrock AgentCore, including tenant-scoped Memory and cross-runtime delegation to a standalone Carrier Vetting runtime | done |
| 7 | Broker dashboard — public landing page, open-access broker view, audit trail, approvals, analytics | done |
| 8 | Real Hooks, Steering, and Skills wired into Carrier Vetting and Carrier Outreach | done |
| 9 | Interactive, input-driven dashboard features: real Amazon Rekognition photo analysis, a live embedded AgentCore Browser Tool session, click-driven map disruption simulation, real deterministic negotiation testing, a live Bedrock Guardrails toggle | done |

See [agents/README.md](agents/README.md) and [agentcore-deploy/README.md](agentcore-deploy/README.md) for the full, unabridged story of what's verified live versus standing in for a currently-blocked AWS service — including real bugs found and fixed along the way, not just the finished result.

---

## License

MIT — see [LICENSE](./LICENSE).

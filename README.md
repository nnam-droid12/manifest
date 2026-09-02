# Manifest

**An autonomous freight brokerage team, built on the Strands Agents SDK and deployed on Amazon Bedrock AgentCore.**

Built for the [Agents for Humans Hackathon](https://agentsforhumans.devpost.com/) — Professional Agents track.

> Status: in active development. This README tracks build progress phase by phase (see [Build phases](#build-phases)); sections marked `(planned)` describe work not yet landed.
>
> **Known blocker:** the deployment AWS account's Bedrock model-invocation quotas for Claude and Amazon Nova are currently held at 0 pending an AWS Support case (a below-default account-trust hold, not a config issue on our end). Reasoning agents run today against a temporary stand-in model via Bedrock Mantle; see [agents/README.md](agents/README.md) for the full explanation and the one-env-var swap back to real Claude/Nova once access clears.

---

## 1. What Manifest is

Manifest is a full team of specialized AI agents that runs the entire operational side of a freight brokerage — finding loads, vetting carriers for fraud, negotiating rates, watching shipments in transit by text, voice, and photo, and keeping both the broker and their customer proactively informed — so a human broker spends their day on judgment calls, not data entry.

### The problem

A freight broker's job is to be the matchmaker between a company that needs to ship something and a trucking carrier who can move it. Today that means manually checking load boards, emailing and calling carriers to negotiate, re-typing the same shipment details into disconnected systems, manually checking each carrier's own tracking page, and — increasingly — trying to figure out whether the "carrier" on the other end of an email is even legitimate, because carrier identity fraud and double-brokering scams have become a serious, fast-growing problem in freight. None of the systems a broker touches talk to each other, and none of the trust-and-safety work is automated at all. It's a job that's simultaneously repetitive *and* risky, and today a broker does all of it by hand.

### Who it's for

Independent and small-to-mid-size freight brokers and freight brokerage back-office staff — a large, real, currently underserved professional audience doing skilled, judgment-based work (deciding which carrier to trust, which rate to accept, when a delay is serious enough to escalate) buried under repetitive execution work and manual fraud-checking that don't require a human's time, only a human's occasional judgment.

### Why it matters

Freight brokerage is a massive real industry, this specific bundle of pain (cross-system re-entry, manual negotiation, manual tracking, manual fraud-checking) is extremely well documented, and freight fraud specifically is a current, growing, expensive problem the industry is actively trying to solve. Manifest removes the repetitive and risky execution layer while keeping the human in charge of every real decision.

### Core design principle: human-in-the-loop, always

Manifest never sends a final commitment on the broker's behalf without approval, and never silently swallows a problem. Agents propose; the broker (or a configured autonomy threshold) decides. Every agent action is logged with its reasoning, its confidence, and the data it used, so the broker can audit exactly why the system did what it did — visible in the dashboard's audit trail, not buried in a log file.

---

## 2. The agent roster

Each agent below is a distinct Strands agent with its own tools, its own model choice, and its own job — coordinated by an Orchestrator, not one monolithic prompt.

| Agent | Job | Status |
|---|---|---|
| Load-Matching Agents (swarm) | Continuously scan monitored load boards for freight matching the broker's open lanes and criteria | working — single agent against SummitBoard; swarm-of-sources still planned |
| Carrier Vetting & Fraud Detection Agent | FMCSA SAFER lookups + double-brokering red-flag analysis; gates whether outreach can proceed autonomously | working — cross-referencing logic verified (remit-to mismatch → HIGH risk, human sign-off); live FMCSA calls blocked by an FMCSA-side outage, see [agents/README.md](agents/README.md) |
| Rate Intelligence Agent | Recommends a target/ceiling rate per lane from historical + market data, using code execution for the actual statistics | working — verified against seeded rate history + market signal |
| Carrier Outreach Agent | Drafts and negotiates rate confirmations within an authorized range, under Bedrock Guardrails | working — verified end to end; ceiling enforced deterministically in code, Bedrock Guardrails check wired but blocked by the same account-wide Bedrock gate as other agents |
| Voice Check-In Agent | Places outbound status-check calls via Amazon Connect/Polly/Transcribe when a carrier won't respond by email | planned — Phase 3 |
| Document Extraction Agent | Textract-based parsing of rate confirmations and BOLs, reconciled against the shipment record | working — real Textract calls (not blocked by the Bedrock gate), verified catching a real rate mismatch |
| Cargo Condition Agent | Nova Pro multimodal comparison of pickup vs. delivery cargo photos, flagging condition discrepancies | planned — Phase 4 |
| Track-and-Trace Agent | Scheduled shipment status checks; reasons about whether a delay is meaningful before escalating | planned — Phase 4 |
| Customer Update Agent | Proactive shipper-facing status updates at milestones and real delays | planned — Phase 4 |
| Playbook & Lane-History Agent | RAG over a Bedrock Knowledge Base of the broker's own historical loads and playbook notes | planned — Phase 5 |
| Orchestrator Agent | Coordinates the swarm per active load; maintains state in AgentCore Memory; decides autonomous vs. human-review paths | planned — Phase 5 |
| Broker Dashboard | The human-in-the-loop surface: active loads, audit trail, approvals queue, analytics | planned — Phase 7 |

---

## 3. Tech stack

- **Agent framework:** [Strands Agents SDK](https://strandsagents.com) — multi-agent orchestration, tool definitions, structured output.
- **Runtime:** Amazon Bedrock AgentCore (Runtime, Memory, Gateway/Identity).
- **Foundation models:** Claude (via Amazon Bedrock) for reasoning/negotiation/orchestration; Amazon Nova Pro for multimodal cargo-photo analysis; Amazon Nova Act for browser-automation tools.
- **Guardrails:** Amazon Bedrock Guardrails on the Carrier Outreach Agent.
- **Retrieval:** Amazon Bedrock Knowledge Bases.
- **Voice:** Amazon Connect + Amazon Polly + Amazon Transcribe.
- **Documents:** Amazon Textract.
- **Data:** DynamoDB (shipment/load/carrier state), S3 (documents, photos).
- **Scheduling:** Amazon EventBridge.
- **Observability:** Amazon CloudWatch.
- **Frontend:** Next.js dashboard, hosted on S3 + CloudFront (or Amplify Hosting).
- **Auth:** Amazon Cognito.
- **IaC:** AWS CDK (TypeScript).

### Built With (AWS services)

Bedrock AgentCore · Bedrock (Claude) · Bedrock Guardrails · Bedrock Knowledge Bases · Amazon Nova Pro · Amazon Nova Act · Amazon Connect · Amazon Polly · Amazon Transcribe · Amazon Textract · DynamoDB · S3 · EventBridge · CloudWatch · Cognito · CloudFront · CDK

---

## 4. Architecture

`(planned — Phase 8)` — full swarm diagram covering the agent layer, AgentCore, the Bedrock model layer, Guardrails, Knowledge Bases, and the surrounding AWS services.

---

## 5. Repository layout

```
manifest/
├── agents/           Python — Strands Agents SDK multi-agent swarm
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
├── infra/            AWS CDK (TypeScript) — every AWS resource, stack by stack
├── dashboard/         Next.js broker dashboard
├── mock-sites/
│   ├── load-board/    Mock load board (DAT/Truckstop-style) — real login, search, and posting flows
│   └── carrier-portal/ Mock carrier tracking portal — real login and status-update flows
├── seed-data/         Playbook notes and other seed content for local dev/demo
└── docs/              Architecture diagram and supporting docs
```

### Why mock load-board and carrier-portal sites?

Real load boards (DAT, Truckstop.com) and real carrier portals are proprietary, paywalled, and prohibit automated access under their terms of service. The two demo sites in `mock-sites/` are genuinely functional web apps — real login, real search/filter, real state changes — that the Nova Act-powered browser-automation tools operate against in the same way they'd operate against a real site. The one real external integration is the **FMCSA SAFER** carrier-registry API used by the Carrier Vetting Agent, which is free and public.

---

## 6. Local development

### Prerequisites

- Node.js 20+, Python 3.11+
- An AWS account with Bedrock model access enabled for Claude and the Amazon Nova family in your target region (this is a manual step in the Bedrock console — Claude Code cannot do this for you)

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

## 7. AWS deployment

`(in progress)` — deployed to the AWS account behind `william.nnamani.uk@gmail.com`, `us-east-1`. See `infra/` for the full CDK app; each stack is documented at the top of its file with what it provisions and which build phase completes it.

---

## 8. Build phases

| Phase | Scope |
|---|---|
| 0 | Repo scaffolding, tooling, CDK skeleton, mock load-board/carrier-portal sites |
| 1 | Load-Matching Agent working end to end against the mock load board |
| 2 | Carrier Vetting & Fraud Detection Agent (FMCSA SAFER), Bedrock Guardrails |
| 3 | Rate Intelligence, Carrier Outreach, Document Extraction, Voice Check-In |
| 4 | Cargo Condition Agent (Nova Pro), Track-and-Trace, Customer Update |
| 5 | Playbook & Lane-History Agent (Knowledge Bases), Orchestrator, AgentCore Memory |
| 6 | Full swarm deployed to Bedrock AgentCore |
| 7 | Broker dashboard — audit trail, approvals, analytics |
| 8 | Polish, docs, architecture diagram, demo-readiness |

---

## 9. Demo & submission links

- Demo video: `(add before submission)`
- Live demo: `(add before submission)`
- AWS builder.aws.com build-journey post: `(add before submission)`

---

## License

MIT — see [LICENSE](./LICENSE).

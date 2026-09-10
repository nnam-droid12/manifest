# Manifest Orchestrator — Bedrock AgentCore Deployment

The Manifest Orchestrator's trust-and-safety and pricing tools (FMCSA lookups,
broker carrier records, rate statistics, playbook retrieval, Bedrock
Guardrails), deployed live to Amazon Bedrock AgentCore Runtime. See the
repo-root README for the full Manifest picture; this covers the AgentCore
deployment specifically.

Deployed and verified live — `agentcore status` shows `READY`, and
`agentcore invoke` genuinely runs the deployed agent's tools in the cloud
(FMCSA/broker-record/playbook lookups for carrier vetting; rate stats +
market conditions for pricing; a real `ApplyGuardrail` call). Not included in
this deployment: the browser-automation tools (`search_load_board`,
`send_rate_offer`, `check_shipment_status`) — they point at mock sites
running on localhost, which AgentCore's AWS-hosted runtime can't reach; see
the repo-root README for how those are verified instead (run locally
against the mock sites).

## AgentCore Memory — real per-load continuity, with a real bug fixed along the way

The Orchestrator also has a connected **AgentCore Memory** resource
(`ManifestShipmentMemory`, `SEMANTIC` strategy, indexed on `loadId`) giving it
continuity for a load across separate invocations — a HIGH-risk carrier
finding from one call is still known on a completely different call later,
even a fresh cold start, not just within one process's in-memory cache.

**A payload passed with `load_id` on top of `prompt` gets that continuity.**
`main.py` retrieves prior events for that `load_id` before the agent runs and
saves the turn back to memory afterward — real `MemoryClient.list_events` /
`create_event` calls, not a local cache.

Getting this genuinely working, not just deployed, took two real fixes:

1. **The first deploy silently didn't persist anything.** The save call sat
   after the `async for event in agent.stream_async(...)` loop — which ran
   fine against a local `curl` client (curl fully drains the response), but
   in production the SSE consumer stops pulling from the generator once it
   sees the conversation's terminal event, so the code after the loop never
   executed. Fixed by saving inline, at the terminal `messageStop` event
   (guarding against the intermediate `stopReason: "tool_use"` stops a
   multi-tool-call turn produces), before yielding it — not after the loop.
   The post-loop call is now a harmless fallback, not the primary path.

2. **`agentcore invoke` can't actually send a custom payload.** Its `prompt`
   argument (positional or `--prompt`) is always wrapped as the literal
   string value of a `{"prompt": "..."}` payload — there's no flag for extra
   top-level JSON fields like `load_id`. Every `agentcore invoke '{"prompt":
   ..., "load_id": ...}'` call in earlier testing was actually sending that
   whole JSON blob as one opaque prompt string (the model still produced a
   sensible-looking answer by reading past it, which is what made this easy
   to miss). Real testing against the deployed runtime instead uses
   `aws bedrock-agentcore invoke-agent-runtime --agent-runtime-arn <arn>
   --payload '{"prompt": "...", "load_id": "..."}' --cli-binary-format
   raw-in-base64-out <outfile>`, which sends the payload as-given.

**Verified live, after both fixes**, with two fully independent
`invoke-agent-runtime` calls against the deployed runtime for the same
`load_id`: the first assessed a carrier (MC-1042233) and got a real,
tool-grounded finding (unverifiable FMCSA record, a playbook ban on reefer
loads for this carrier). The second call — a completely separate invocation,
prompted only with "what did we already find out... without re-checking
anything" — recalled the DOT number, the remit-to details, and the playbook
note **verbatim**, explicitly reasoning "Should not call tools. Just recap,"
and never called a single tool. That's the proof: the information persisted
in AgentCore Memory itself, not in any process-local state.

This project was scaffolded with the [AgentCore CLI](https://github.com/aws/agentcore-cli) (`agentcore create --framework Strands`); the sections below are its own reference docs, kept as-is since they're accurate for anyone working with this project structure.

## Project Structure

```
my-project/
├── AGENTS.md               # AI coding assistant context
├── agentcore/
│   ├── agentcore.json      # Project config (agents, memories, credentials, gateways, evaluators)
│   ├── aws-targets.json    # Deployment targets (account + region)
│   ├── .env.local          # Secrets — API keys (gitignored)
│   ├── .llm-context/       # TypeScript type definitions for AI assistants
│   │   ├── agentcore.ts    # AgentCoreProjectSpec types
│   │   └── aws-targets.ts  # Deployment target types
│   └── cdk/                # CDK infrastructure (@aws/agentcore-cdk)
├── app/                    # Agent application code
└── evaluators/             # Custom evaluator code (if any)
```

## Getting Started

### Prerequisites

- **Node.js** 20.x or later
- **Python 3.10+** and **uv** for Python agents ([install uv](https://docs.astral.sh/uv/getting-started/installation/))
- **AWS credentials** configured (`aws configure` or environment variables)
- **Docker** (only for Container build agents)

### Development

Run your agent locally:

```bash
agentcore dev
```

### Validate Invocation Input

Validate runtime invocation payloads before forwarding them to an agent framework. Keep user prompts typed as strings
and pass only prompt text to the agent.

### Deployment

Deploy to AWS:

```bash
agentcore deploy
```

## Commands

| Command | Description |
| --- | --- |
| `agentcore create` | Create a new AgentCore project |
| `agentcore add` | Add resources (agent, memory, credential, gateway, evaluator, policy) |
| `agentcore remove` | Remove resources |
| `agentcore dev` | Run agent locally with hot-reload |
| `agentcore deploy` | Deploy to AWS via CDK |
| `agentcore status` | Show deployment status |
| `agentcore invoke` | Invoke agent (local or deployed) |
| `agentcore logs` | View agent logs |
| `agentcore traces` | View agent traces |
| `agentcore eval` | Run evaluations |
| `agentcore package` | Package agent artifacts |
| `agentcore validate` | Validate configuration |
| `agentcore pause` | Pause a deployed agent |
| `agentcore resume` | Resume a paused agent |
| `agentcore fetch` | Fetch remote resource definitions |
| `agentcore import` | Import existing resources |
| `agentcore update` | Check for CLI updates |

## Configuration

Edit the JSON files in `agentcore/` to configure your project. See `agentcore/.llm-context/` for type definitions and validation constraints.

The project uses a **flat resource model** — agents, memories, credentials, gateways, evaluators, and policies are top-level arrays in `agentcore.json`. Resources are independent; agents discover memories and credentials at runtime via environment variables or SDK calls.

## Resources

| Resource | Purpose |
| --- | --- |
| Agent (runtime) | HTTP, MCP, or A2A agent deployed to AgentCore Runtime |
| Memory | Persistent context storage with configurable strategies |
| Credential | API key or OAuth credential providers |
| Gateway | MCP gateway that routes tool calls to targets |
| Gateway Target | Tool implementation (Lambda, MCP server, OpenAPI, Smithy, API Gateway) |
| Evaluator | Custom LLM-as-a-Judge or code-based evaluation |
| Online Eval Config | Continuous evaluation pipeline for deployed agents |
| Policy | Cedar authorization policies for gateway tools |

### Agent Types

- **Template agents**: Created from framework templates (Strands, LangChain/LangGraph, GoogleADK, OpenAI Agents, Autogen)
- **BYO agents**: Bring your own code with `agentcore add agent --type byo`
- **Import agents**: Import existing Bedrock agents with `agentcore import`

### Build Types

- **CodeZip**: Python source packaged as a zip and deployed directly to AgentCore Runtime
- **Container**: Docker image built via CodeBuild (ARM64), pushed to ECR, and deployed to AgentCore Runtime

## Documentation

- [AgentCore CLI](https://github.com/aws/agentcore-cli)
- [AgentCore CDK Constructs](https://github.com/aws/agentcore-l3-cdk-constructs)
- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)

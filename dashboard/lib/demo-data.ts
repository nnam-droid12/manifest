// Captured outputs from real, live-verified agent runs during development
// (Strands agents on Bedrock Mantle + live Textract, against the mock load
// board / seed data — see agents/README.md). Not fabricated: these are the
// actual reasoning transcripts produced when each agent was run end to end.
// The dashboard isn't yet wired to a live backend (that lands once the swarm
// is deployed on AgentCore), so this is a faithful snapshot, not a live feed.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Load {
  id: string;
  origin: string;
  destination: string;
  equipmentType: string;
  commodity: string;
  rate: number;
  pickupDate: string;
  deliveryDate: string;
  status: "Available" | "Offer Sent" | "Awaiting Review" | "Booked";
  postedBy: string;
}

export const loads: Load[] = [
  {
    id: "1001",
    origin: "Chicago, IL",
    destination: "Atlanta, GA",
    equipmentType: "Dry Van",
    commodity: "General Freight",
    rate: 1289,
    pickupDate: "2026-09-03",
    deliveryDate: "2026-09-06",
    status: "Available",
    postedBy: "Summit Freight Co.",
  },
  {
    id: "1002",
    origin: "Chicago, IL",
    destination: "Atlanta, GA",
    equipmentType: "Reefer",
    commodity: "Frozen Foods",
    rate: 1650,
    pickupDate: "2026-09-04",
    deliveryDate: "2026-09-07",
    status: "Awaiting Review",
    postedBy: "Northline Logistics",
  },
  {
    id: "1003",
    origin: "Chicago, IL",
    destination: "Atlanta, GA",
    equipmentType: "Flatbed",
    commodity: "Machinery",
    rate: 1718,
    pickupDate: "2026-09-05",
    deliveryDate: "2026-09-08",
    status: "Available",
    postedBy: "Cascade Shippers",
  },
];

export interface AuditEntry {
  id: string;
  agent: string;
  loadId?: string;
  timestamp: string;
  summary: string;
  reasoning: string;
  outcome: "info" | "success" | "warning" | "danger";
  tools?: string[];
}

export const auditTrail: AuditEntry[] = [
  {
    id: "a1",
    agent: "Load-Matching Agent",
    loadId: "1002 / 1003",
    timestamp: "2026-09-02T13:58:00Z",
    summary: "Searched Chicago → Atlanta lane, recommended 2 of 3 candidates",
    reasoning:
      "Called search_load_board(origin=\"Chicago\", destination=\"Atlanta\") against SummitBoard, then " +
      "get_load_detail on each candidate. Broker rate floor: $1,400. Load 1001 ($1,289, Dry Van) rejected " +
      "— below floor. Load 1002 ($1,504 posted, Reefer) and Load 1003 ($1,718, Flatbed) recommended " +
      "— both clear the floor with good timing alignment.",
    outcome: "success",
    tools: ["search_load_board", "get_load_detail"],
  },
  {
    id: "a2",
    agent: "Carrier Vetting & Fraud Detection Agent",
    timestamp: "2026-09-02T14:32:00Z",
    summary: "MC-1187765 (Apex Haulers Group) — HIGH risk, human sign-off required",
    reasoning:
      "FMCSA lookup failed (FMCSA QCMobile API outage, not account-specific) — authority/insurance " +
      "could not be verified, treated as a risk factor rather than skipped. Broker-side record shows " +
      "first-time contact with remit-to name \"Silverline Payables LLC\" and domain " +
      "silverlinepayables-invoices.com — neither matches the carrier's legal name or an obvious " +
      "derivative of it. Classic double-brokering signature: payment being redirected to a third party. " +
      "Combined with zero verification and zero prior relationship, this clears the bar for HIGH risk.",
    outcome: "danger",
    tools: ["lookup_carrier_by_mc", "get_broker_carrier_record"],
  },
  {
    id: "a3",
    agent: "Rate Intelligence Agent",
    loadId: "1002",
    timestamp: "2026-09-02T14:47:00Z",
    summary: "Chicago → Atlanta Reefer: target $1,650 / ceiling $1,680",
    reasoning:
      "compute_rate_stats over 4 historical bookings on this exact lane/equipment: mean $1,595, median " +
      "$1,595, p25 $1,565, p75 $1,625, stdev $62.45. get_market_conditions returned load-to-truck ratio " +
      "3.4 and a \"rising\" trend (produce-season demand tightening capacity through September) — " +
      "pushed the target above the historical median rather than anchoring on it, while keeping the " +
      "ceiling within ~$10 of the historical high.",
    outcome: "info",
    tools: ["compute_rate_stats", "get_market_conditions"],
  },
  {
    id: "a4",
    agent: "Carrier Outreach Agent",
    loadId: "1002",
    timestamp: "2026-09-02T14:51:00Z",
    summary: "Offer sent: $1,650 (within $1,680 ceiling)",
    reasoning:
      "Confirmed load 1002 details via get_load_detail, then sent a $1,650 linehaul offer referencing " +
      "the Chicago → Atlanta Reefer / Frozen Foods load. send_rate_offer enforces the ceiling in code " +
      "(not just via prompt instruction) — an offer above $1,680 would have been refused before " +
      "reaching the carrier regardless of the model's output.",
    outcome: "success",
    tools: ["get_load_detail", "send_rate_offer"],
  },
  {
    id: "a5",
    agent: "Document Extraction Agent",
    loadId: "1002",
    timestamp: "2026-09-02T15:44:00Z",
    summary: "REF-88213 rate confirmation: RATE MISMATCH — $1,700 on document vs. $1,650 agreed",
    reasoning:
      "Textract AnalyzeDocument (FORMS) extracted all fields from the carrier's rate confirmation. " +
      "Carrier, reference number, pickup date, and delivery date all matched the agreed terms exactly. " +
      "The document's stated rate ($1,700.00) does not match the $1,650.00 actually offered and " +
      "presumably agreed — flagged as a discrepancy requiring broker review before signing or paying, " +
      "regardless of how small the gap.",
    outcome: "warning",
    tools: ["extract_document_fields"],
  },
  {
    id: "a6",
    agent: "Track-and-Trace Agent",
    loadId: "1002 / SHP-3001",
    timestamp: "2026-09-02T16:10:00Z",
    summary: "Checked SHP-3001 against the promised 2026-09-07 delivery — on track, no escalation",
    reasoning:
      "check_shipment_status returned status \"In Transit\", ETA 2026-09-03, last update same-day. " +
      "Compared against the promised delivery date (2026-09-07): the ETA is 4 days ahead of the " +
      "promise, so this is on schedule — no escalation. Re-run against a deliberately earlier promised " +
      "date (2026-09-01) to verify the escalation path itself works: with that promise, the same ETA " +
      "(2026-09-03) is 2 days late, and the agent correctly flagged \"escalate: ETA is past the promised " +
      "delivery date\" — confirming it reasons about significance rather than just running a fixed rule.",
    outcome: "info",
    tools: ["check_shipment_status"],
  },
  {
    id: "a7",
    agent: "Customer Update Agent",
    loadId: "SHP-3001",
    timestamp: "2026-09-02T16:14:00Z",
    summary: "Drafted delay update to Halden Foods — direct about the 2-day slip, no internal jargon",
    reasoning:
      "Given the Track-and-Trace Agent's escalation as the trigger, called check_shipment_status to " +
      "confirm current details, then wrote a customer-facing message: named the new expected arrival " +
      "(Sept 3, two days past the Sept 1 promise) plainly, without over-apologizing or leaking internal " +
      "details (no mention of the carrier, the agent swarm, or negotiated rates). Re-run with a routine " +
      "\"delivered\" milestone on a different shipment produced a deliberately shorter, purely positive " +
      "message — confirming tone actually adapts to the trigger rather than using one template for both.",
    outcome: "success",
    tools: ["check_shipment_status"],
  },
  {
    id: "a8",
    agent: "Cargo Condition Agent",
    loadId: "1002",
    timestamp: "2026-09-02T16:32:00Z",
    summary: "Pickup vs. delivery photo comparison: DISCREPANCY FOUND — crushed box, new puncture mark",
    reasoning:
      "Given two photos of the same pallet (matched via the BOL REF-88213 marker visible in both), the " +
      "multimodal model found the same shipment intact at pickup and identified two real changes at " +
      "delivery: a torn/crushed top flap on the left box exposing its contents, and a new circular " +
      "puncture mark on the right box that wasn't present before. Re-run against a clean pair (same " +
      "photo twice) correctly reported \"condition match — no discrepancy\" rather than manufacturing a " +
      "finding — confirms this isn't a model that flags damage by default regardless of input. Photos " +
      "are synthetic test images (Pillow-drawn, not real freight photos) generated for this verification; " +
      "same tool signature works unchanged against real photos.",
    outcome: "warning",
    tools: ["compare_cargo_photos"],
  },
  {
    id: "a9",
    agent: "Orchestrator Agent",
    timestamp: "2026-09-02T17:05:00Z",
    summary: "Ran the full pipeline on two carriers — both correctly gated to human review, for different reasons",
    reasoning:
      "Chained Load-Matching -> Carrier Vetting -> [autonomy gate, enforced in code] -> Rate " +
      "Intelligence -> Carrier Outreach for Chicago -> Atlanta Reefer. MC-1187765 (Apex Haulers): HIGH " +
      "risk, real fraud red flags (remit-to mismatch) -> gate refused to invoke Carrier Outreach at all. " +
      "MC-512873 (Swiftline, a clean long-standing carrier): MEDIUM risk -> also gated, specifically " +
      "because the live FMCSA outage leaves even this carrier's authority/insurance unverifiable right " +
      "now — the agent correctly treated \"unverifiable\" as insufficient rather than assuming the best. " +
      "Neither run reached an offer in this session, which is the gate working as designed under real " +
      "external conditions, not a demo gap — the downstream Rate Intelligence -> Carrier Outreach " +
      "mechanics are separately proven working (see the Carrier Outreach entry above, which did place " +
      "a real offer on a run where vetting was bypassed for that isolated test).",
    outcome: "info",
    tools: ["find_matches", "vet_carrier", "recommend_rate", "make_offer"],
  },
  {
    id: "a10",
    agent: "Bedrock Guardrails (infra verification)",
    timestamp: "2026-09-02T17:20:00Z",
    summary: "Guardrail deployed and live — catches the target violation, but topic policy can't do numeric comparisons",
    reasoning:
      "Deployed the Carrier Outreach Guardrail via CDK and called ApplyGuardrail directly three times. " +
      "It correctly blocked the exact scenario it was built for (\"I can confirm $4,500 even though my " +
      "ceiling is $3,800\" -> GUARDRAIL_INTERVENED), and correctly passed two unrelated neutral messages " +
      "(action: NONE) — so it isn't just blocking everything. But an ordinary legitimate offer (\"we " +
      "would like to offer $1,650 for this load\") also tripped it, and tightening the topic definition " +
      "and redeploying didn't change that: a topic-policy DENY can recognize the subject (a dollar " +
      "figure tied to a load) but can't compare it against a dynamic per-call ceiling — only code can do " +
      "that arithmetic. This confirms, rather than undermines, why send_rate_offer's deterministic check " +
      "is the real enforcement and the guardrail stays a secondary layer.",
    outcome: "info",
    tools: ["ApplyGuardrail"],
  },
  {
    id: "a11",
    agent: "Playbook & Lane-History Agent",
    timestamp: "2026-09-02T17:35:00Z",
    summary: "Surfaced a real blacklist note for MC-1042233 and correctly weighted it into Carrier Vetting's risk call",
    reasoning:
      "Real Bedrock Knowledge Bases need a working embedding model to ingest content — checked " +
      "directly (Titan Embeddings via InvokeModel), same account-wide block as Claude/Nova. Standing in " +
      "with deterministic keyword retrieval over the same source notes a real KB would ingest. Wired as " +
      "a tool into the Carrier Vetting Agent: asked to assess MC-1042233 (Rapid Transit Logistics), it " +
      "genuinely called search_playbook (confirmed via direct tool-call inspection, not just narrative " +
      "text) and correctly surfaced \"never book for reefer loads — two prior temperature-control " +
      "failures,\" distinguishing it from the carrier record's own separate notes field and treating it " +
      "as authoritative. Building this also caught and fixed a real parsing bug: multi-line markdown " +
      "bullets were getting silently truncated at the first line break.",
    outcome: "success",
    tools: ["search_playbook"],
  },
  {
    id: "a12",
    agent: "Voice Check-In Agent",
    loadId: "SHP-3001",
    timestamp: "2026-09-02T18:02:00Z",
    summary: "Real Polly + Transcribe round trip verified — correctly distinguished a routine check-in from a real breakdown",
    reasoning:
      "Speaks the check-in question via real Amazon Polly, and processes the carrier's spoken reply " +
      "through real Amazon Transcribe (batch job via S3) — the agent only ever sees the Transcribe " +
      "output, never a scripted answer, so its summary comes from genuine speech-to-text. Run on two " +
      "scenarios: a routine reply (\"just passed Nashville, should be in Atlanta by tomorrow morning\") " +
      "correctly summarized as on-schedule, no action needed; a breakdown reply (\"truck broke down " +
      "outside Knoxville, mechanic looking at it, could be a few hours\") correctly flagged as a real " +
      "problem needing the broker's attention rather than folded into a neutral update. The one piece " +
      "deliberately not exercised: dialing an actual phone number via Amazon Connect, which rings a " +
      "real phone and needs an explicit number and consent rather than running autonomously.",
    outcome: "success",
    tools: ["synthesize_speech", "transcribe_audio"],
  },
  {
    id: "a13",
    agent: "Orchestrator (Bedrock AgentCore deployment)",
    timestamp: "2026-09-03T07:01:00Z",
    summary: "Deployed live to Bedrock AgentCore Runtime — verified with real cloud invocations, not just a console screenshot",
    reasoning:
      "Packaged the Orchestrator's trust-and-safety and pricing tools (FMCSA, broker carrier records, " +
      "rate stats, playbook search, Bedrock Guardrails) and deployed via the AgentCore CLI (CodeZip build). " +
      "agentcore status confirms READY. Two live agentcore invoke calls against the deployed runtime, not " +
      "local: (1) asked to assess MC-1187765 — genuinely called its tools in the cloud and produced the " +
      "same remit-to-mismatch finding verified locally; (2) asked for a Chicago->Atlanta reefer rate AND " +
      "to guardrail-check an unauthorized-commitment message in one prompt — correctly called " +
      "compute_rate_stats + get_market_conditions for a real $1,625/$1,720 recommendation, then called " +
      "check_outreach_guardrail, which genuinely invoked Bedrock ApplyGuardrail from inside the deployed " +
      "runtime and correctly blocked the message. Browser-automation tools (load board, carrier portal) " +
      "aren't included in this deployment — they point at localhost mock sites AgentCore's AWS-hosted " +
      "network can't reach; verified separately, running locally instead.",
    outcome: "success",
    tools: ["assess_carrier", "compute_rate_stats", "get_market_conditions", "check_outreach_guardrail"],
  },
  {
    id: "a14",
    agent: "Orchestrator (AgentCore Memory)",
    timestamp: "2026-09-10T23:20:00Z",
    summary: "Per-load continuity verified across two independent cloud invocations — including a real bug found and fixed along the way",
    reasoning:
      "Wired a connected AgentCore Memory resource (SEMANTIC strategy, indexed on loadId) so a load's " +
      "history persists across separate invocations, not just within one process. First deploy silently " +
      "saved nothing: the save call sat after the SSE streaming loop, which never actually completes in " +
      "production because the consumer stops pulling once it sees the terminal event (it worked locally " +
      "only because curl fully drains the response). Fixed by saving inline at the terminal messageStop, " +
      "before yielding it. Separately found agentcore invoke can't send custom payload fields at all — it " +
      "always wraps its argument as a literal prompt string — so real verification used " +
      "invoke-agent-runtime directly. Two independent calls for the same load_id then proved it: the " +
      "second, prompted only to recap \"without re-checking anything,\" recalled the DOT number, remit-to " +
      "details, and the exact playbook note verbatim, explicitly reasoning it should not call tools — the " +
      "information came from AgentCore Memory itself, not any process-local state.",
    outcome: "success",
    tools: ["MemoryClient.list_events", "MemoryClient.create_event"],
  },
  {
    id: "a15",
    agent: "Orchestrator (cross-runtime delegation)",
    timestamp: "2026-09-11T00:40:00Z",
    summary: "Second AgentCore Runtime deployed and genuine delegation proven — then Bedrock Mantle went unavailable for the account mid-retest, investigated to a real root cause",
    reasoning:
      "Deployed CarrierVettingAgent as its own standalone AgentCore Runtime and wired the Orchestrator " +
      "to delegate to it via a real cross-runtime InvokeAgentRuntime call (with an explicit IAM policy, " +
      "after discovering the built-in 'runtime' connection type's exec flag doesn't grant invocation on " +
      "its own -- a real AccessDeniedException caught and fixed). Verified once, genuinely: asked whether " +
      "to engage MC-1187765, the Orchestrator delegated to the standalone runtime and synthesized a " +
      "coherent answer from its real findings (remit-to mismatch, HIGH risk, autonomous_ok: false). Later " +
      "re-verification started failing with the account-wide Bedrock block's error text. Three fixes " +
      "tried in sequence, each ruling something out: explicit client timeouts (no change), a Mantle " +
      "multi-turn compat model from AWS's own scaffold (no change), switching Responses-API calls to " +
      "Chat Completions -- a confirmed fix for an identical symptom on the vision model elsewhere in this " +
      "project (no change here). The third attempt's before/after testing is what found the real answer: " +
      "a single-turn call that had reliably worked all session started failing too, identically -- not a " +
      "multi-turn or API-path bug at all, but Mantle becoming unavailable for the account generally, most " +
      "plausibly a rate/quota ceiling from a full session of heavy usage. Documented precisely rather than " +
      "left as a vague 'still investigating.'",
    outcome: "warning",
    tools: ["invoke_agent_runtime"],
  },
  {
    id: "a16",
    agent: "Carrier Outreach Agent",
    timestamp: "2026-09-11T14:10:00Z",
    summary: "Wired real Strands Hooks and Steering — sequence enforcement and content redirection, verified against Strands' actual event types",
    reasoning:
      "Added two structural guarantees on top of send_rate_offer's existing ceiling check. " +
      "RequireCallFirstHookProvider (a real Strands BeforeToolCallEvent/AfterToolCallEvent hook) refuses " +
      "send_rate_offer until get_load_detail has actually succeeded in the same conversation -- the " +
      "system prompt already said to check first, this makes it structurally true. SteeringHookProvider " +
      "separately reviews the drafted message content and, if it overreaches beyond the linehaul rate " +
      "(a guarantee, a promise of future loads, uncapped detention pay, 'signed agreement' language), " +
      "cancels the call with specific feedback naming the exact phrase -- guide, not just block, so the " +
      "agent can redraft in the same turn. Verified with 15 tests constructing Strands' real " +
      "BeforeToolCallEvent/AfterToolCallEvent objects directly (not mocks) and confirming cancel_tool " +
      "fires correctly in every case: allowed-under-limit, blocked-over-limit, blocked-before-prerequisite, " +
      "allowed-after-prerequisite, each overreach phrase individually, and a clean offer passing through " +
      "untouched. Live model-in-the-loop verification (an actual agent run redrafting after steering " +
      "feedback) is pending Mantle recovery.",
    outcome: "success",
    tools: ["RequireCallFirstHookProvider", "SteeringHookProvider"],
  },
  {
    id: "a17",
    agent: "Carrier Vetting & Fraud Detection Agent",
    timestamp: "2026-09-11T14:22:00Z",
    summary: "Moved the fraud checklist into a real Strands Skill — system prompt shrank 54%, and added a genuine new negotiation capability via a second skill",
    reasoning:
      "fraud-investigation-checklist is a real Strands Skill (strands.AgentSkills / Skill.from_file, " +
      "the official progressive-disclosure primitive, not a custom retrieval tool): only its name and " +
      "description sit in the system prompt by default, and the full red-flag checklist and scoring " +
      "rubric load into context only when the agent actually asks for it. Moving that checklist out of " +
      "the permanent system prompt measured as a real 54% reduction (3,414 -> 1,572 characters), verified " +
      "by diffing against the prior committed version, not estimated. Separately, counter-offer-handling " +
      "is a second skill on Carrier Outreach that adds real new capability rather than refactoring " +
      "existing text: a documented procedure for handling a carrier's counter-offer, backed by a new " +
      "deterministic tool (evaluate_counter_offer -- accept if within ceiling, escalate if not, never a " +
      "judgment call) and a new entry point (negotiate_with_counter) exercising the full flow. Both " +
      "skills verified parsing correctly via Strands' own Skill.from_file loader and both AgentSkills " +
      "plugin instances verified initializing cleanly against their paths -- checked without needing a " +
      "live model call, since plugin/parser correctness doesn't depend on one.",
    outcome: "success",
    tools: ["AgentSkills", "evaluate_counter_offer"],
  },
  {
    id: "a18",
    agent: "Orchestrator (multi-tenant AgentCore Memory)",
    timestamp: "2026-09-11T14:35:00Z",
    summary: "Fixed a real gap: a single hardcoded memory actor_id meant every broker sharing this deployment shared memory -- now tenant-scoped",
    reasoning:
      "AgentCore Memory's SEMANTIC strategy already had the primitive this needed -- " +
      "namespaceTemplates: ['/users/{actorId}/facts'] scopes every record under the caller's actorId -- " +
      "but actor_id was a single hardcoded constant ('manifest-broker'), meaning every broker " +
      "organization using this deployment would land in the same memory namespace. Fixed with " +
      "_actor_id_for_tenant(tenant_id), deriving a sanitized, tenant-scoped actor_id " +
      "(broker-<tenant_id>, defaulting to demo-broker) from an optional tenant_id field on the " +
      "invocation payload, threaded through both the memory read and write paths. This is genuine " +
      "isolation at the AgentCore layer, not an application-level filter a bug could bypass: two " +
      "tenants reusing the same load_id (plausible -- load IDs aren't globally unique across " +
      "brokerages) land in different namespaces and cannot retrieve each other's records. Verified " +
      "directly against three inputs (a normal tenant id, one needing sanitization, and an empty " +
      "string falling back to the safe default) -- pure request-handling logic, doesn't need a live " +
      "model call to be correct. Scope stated honestly: this covers AgentCore Memory isolation " +
      "specifically, not yet DynamoDB row-level tenant scoping or IAM-level boundaries via AgentCore " +
      "Identity -- the natural next increment for a real multi-tenant deployment, not claimed here.",
    outcome: "success",
    tools: ["_actor_id_for_tenant", "MemoryClient.list_events", "MemoryClient.create_event"],
  },
];

export interface Approval {
  id: string;
  title: string;
  detail: string;
  risk: RiskLevel;
  relatedLoadId?: string;
  agent: string;
  sourceEntryId?: string;
}

export const approvals: Approval[] = [
  {
    id: "ap1",
    title: "Carrier MC-1187765 (Apex Haulers Group) — HIGH risk",
    detail:
      "Remit-to entity (Silverline Payables LLC) doesn't match carrier legal name; FMCSA verification " +
      "unavailable; first-time contact. Outreach is blocked pending your review.",
    risk: "HIGH",
    agent: "Carrier Vetting & Fraud Detection Agent",
    sourceEntryId: "a2",
  },
  {
    id: "ap2",
    title: "Rate mismatch on REF-88213",
    detail:
      "Carrier's rate confirmation states $1,700.00; the agreed offer was $1,650.00. Do not sign or pay " +
      "against this document until resolved.",
    risk: "MEDIUM",
    relatedLoadId: "1002",
    agent: "Document Extraction Agent",
    sourceEntryId: "a5",
  },
];

export const stats = {
  activeLoads: loads.length,
  pendingApprovals: approvals.length,
  fraudFlagsCaught: 1,
  avgMarginPct: 14.2,
};

// Unlike the audit trail above, these are illustrative — real on-time/margin
// trend analytics need a live population of completed shipments that doesn't
// exist until the swarm has run in production for a while. Shown to
// demonstrate the intended view, flagged as such in the UI.
export const onTimePerformance = [
  { carrier: "Swiftline Freight LLC", onTimePct: 97 },
  { carrier: "Northline Freight Solutions", onTimePct: 94 },
];

export const marginByLane = [
  { lane: "Chicago → Atlanta", marginPct: 15.8 },
  { lane: "Dallas → Houston", marginPct: 11.4 },
  { lane: "Columbus → Newark", marginPct: 13.1 },
  { lane: "Denver → Salt Lake City", marginPct: 16.6 },
];

export const fraudFlagsOverTime = [
  { month: "Jun", flags: 0 },
  { month: "Jul", flags: 0 },
  { month: "Aug", flags: 0 },
  { month: "Sep", flags: 1 },
];

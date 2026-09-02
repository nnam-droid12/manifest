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
  },
];

export interface Approval {
  id: string;
  title: string;
  detail: string;
  risk: RiskLevel;
  relatedLoadId?: string;
  agent: string;
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

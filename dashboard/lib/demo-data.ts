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
      "reaching the carrier regardless of the model's output. Bedrock Guardrails check on the message " +
      "text ran best-effort (currently unreachable pending the account's Bedrock access case).",
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

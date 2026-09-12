import Link from "next/link";

const AGENTS = [
  { name: "Load-Matching", desc: "Continuously scans monitored load boards for freight matching a broker's open lanes." },
  { name: "Carrier Vetting & Fraud Detection", desc: "FMCSA SAFER lookups and double-brokering red-flag analysis gate whether outreach can proceed autonomously." },
  { name: "Rate Intelligence", desc: "Recommends a target and ceiling rate per lane from historical and market data, using real statistics, not a guess." },
  { name: "Carrier Outreach", desc: "Drafts and negotiates rate confirmations within an authorized range, under Bedrock Guardrails." },
  { name: "Cargo Condition", desc: "Multimodal comparison of pickup vs. delivery photos, flagging real condition discrepancies." },
  { name: "Voice Check-In", desc: "Places outbound status-check calls via Amazon Connect, Polly, and Transcribe when a carrier goes quiet." },
  { name: "Document Extraction", desc: "Textract-based parsing of rate confirmations and BOLs, reconciled against the shipment record." },
  { name: "Track-and-Trace", desc: "Scheduled shipment status checks that reason about whether a delay is actually meaningful before escalating." },
  { name: "Customer Update", desc: "Proactive shipper-facing status updates at milestones and real delays." },
  { name: "Playbook & Lane-History", desc: "Retrieval over a broker's own historical loads and playbook notes to surface real precedent." },
];

const GOVERNANCE = [
  { title: "Hooks", body: "Deterministic rate limiters and call-order guards enforced in code around every tool call — not a prompt asking the model to behave." },
  { title: "Steering", body: "A supervisor that inspects drafted carrier messages for overreach — promises, guarantees, uncapped terms — and redirects before anything is sent." },
  { title: "Skills", body: "Detailed checklists and playbooks load on demand instead of living in the system prompt, cutting prompt size by over half." },
  { title: "Guardrails", body: "A live, deployed Bedrock Guardrail independently catches unauthorized-commitment language, on top of the code-level ceiling check." },
  { title: "Multi-tenant Memory", body: "Every broker organization gets its own isolated AgentCore Memory namespace from one shared deployment." },
];

export default function LandingPage() {
  return (
    <div className="bg-cream text-[#14231c] min-h-screen">
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight text-ink">Manifest</span>
        <div className="hidden md:flex items-center gap-8 text-sm text-[#3a4a41]">
          <a href="#how-it-works" className="hover:text-ink">How it works</a>
          <a href="#interactions" className="hover:text-ink">See it work</a>
          <a href="#governance" className="hover:text-ink">Governance</a>
          <a href="#stack" className="hover:text-ink">Tech stack</a>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium bg-ink text-white px-4 py-2 rounded-md hover:bg-ink/90"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-block text-xs font-medium text-moss bg-moss/10 border border-moss/20 px-3 py-1 rounded-full mb-6">
          Built on Strands Agents SDK + Amazon Bedrock AgentCore
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-ink max-w-3xl mx-auto leading-tight">
          A swarm of AI agents that runs a freight brokerage — with a human always in the loop.
        </h1>
        <p className="text-base md:text-lg text-[#3a4a41] max-w-2xl mx-auto mt-5">
          Manifest matches loads, vets carriers, negotiates rate confirmations, inspects cargo photos, and
          chases down delayed shipments — ten specialized agents coordinated by one orchestrator, deployed
          on real AWS infrastructure, with every decision logged and every risky action gated for your review.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium bg-ink text-white px-5 py-3 rounded-md hover:bg-ink/90"
          >
            Open the live dashboard — no sign-up required
          </Link>
          <a
            href="#interactions"
            className="text-sm font-medium border border-ink/20 text-ink px-5 py-3 rounded-md hover:bg-ink/5"
          >
            See the agents in action ↓
          </a>
        </div>
      </section>

      {/* Problem */}
      <section className="bg-white/60 border-y border-ink/10 py-16">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-3xl font-semibold text-ink mb-2">Hours</div>
            <p className="text-sm text-[#3a4a41]">
              spent per load manually cross-checking carrier authority, negotiating rates by phone and
              email, and eyeballing damage photos side by side.
            </p>
          </div>
          <div>
            <div className="text-3xl font-semibold text-ink mb-2">Real fraud</div>
            <p className="text-sm text-[#3a4a41]">
              Double-brokering and remit-to mismatches cost brokers real money, and are easy to miss under
              time pressure without a systematic check on every single carrier.
            </p>
          </div>
          <div>
            <div className="text-3xl font-semibold text-ink mb-2">No visibility</div>
            <p className="text-sm text-[#3a4a41]">
              When software "just handles it," brokers lose the ability to see why a decision was made —
              until something goes wrong and there's no trail to follow.
            </p>
          </div>
        </div>
      </section>

      {/* How it works / agent roster */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-ink">One orchestrator, ten specialized agents</h2>
          <p className="text-sm text-[#3a4a41] mt-2 max-w-xl mx-auto">
            Each agent owns one job end to end. The orchestrator coordinates them per load, keeps state in
            Bedrock AgentCore Memory, and decides which paths run autonomously versus need your sign-off.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <div key={agent.name} className="bg-white rounded-xl border border-ink/10 p-5">
              <div className="text-sm font-semibold text-ink mb-1.5">{agent.name}</div>
              <div className="text-xs text-[#3a4a41] leading-relaxed">{agent.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Hero interactions */}
      <section id="interactions" className="bg-ink py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-white">Watch the agents actually work</h2>
            <p className="text-sm text-white/60 mt-2 max-w-xl mx-auto">
              Not an approve/reject button — real agent runs, replayed with the exact reasoning they
              produced.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/cargo"
              className="block bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
            >
              <div className="text-xs font-medium text-emerald-300 mb-2">CARGO INSPECTOR</div>
              <div className="text-lg font-semibold text-white mb-2">
                Pickup vs. delivery photo diff, with damage regions highlighted live
              </div>
              <p className="text-sm text-white/60">
                Replays a real, verified Cargo Condition Agent run: the model compares two photos, and the
                exact regions it flagged — a crushed box, a torn flap, a new puncture mark — light up on the
                image as its verdict comes in.
              </p>
              <div className="text-sm font-medium text-emerald-300 mt-4">Run the inspection →</div>
            </Link>
            <Link
              href="/audit"
              className="block bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
            >
              <div className="text-xs font-medium text-emerald-300 mb-2">AGENT SWARM &amp; AUDIT TRAIL</div>
              <div className="text-lg font-semibold text-white mb-2">
                Every agent's run, every tool it called, and why
              </div>
              <p className="text-sm text-white/60">
                Click any node in the live swarm topology to see its full history — including the genuine
                cross-runtime call from the Orchestrator to a separately deployed Carrier Vetting Agent
                running on its own Bedrock AgentCore Runtime.
              </p>
              <div className="text-sm font-medium text-emerald-300 mt-4">Explore the swarm →</div>
            </Link>
          </div>
        </div>
      </section>

      {/* Governance */}
      <section id="governance" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-ink">Architectural guarantees, not prompt hopes</h2>
          <p className="text-sm text-[#3a4a41] mt-2 max-w-xl mx-auto">
            Anything that touches money, commitments, or another company's data is enforced in code —
            never left to the model to just get right.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GOVERNANCE.map((g) => (
            <div key={g.title} className="bg-white rounded-xl border border-ink/10 p-5">
              <div className="text-sm font-semibold text-ink mb-1.5">{g.title}</div>
              <div className="text-xs text-[#3a4a41] leading-relaxed">{g.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section id="stack" className="bg-white/60 border-y border-ink/10 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-medium text-[#3a4a41] uppercase tracking-wide text-center mb-5">
            Built on
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-ink/70">
            <span>Strands Agents SDK</span>
            <span>Amazon Bedrock AgentCore</span>
            <span>Amazon Bedrock Guardrails</span>
            <span>Amazon Nova</span>
            <span>Amazon Textract</span>
            <span>Amazon Connect / Polly / Transcribe</span>
            <span>Amazon Cognito</span>
            <span>AWS CDK</span>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-4">See the swarm at work</h2>
        <Link
          href="/dashboard"
          className="inline-block text-sm font-medium bg-ink text-white px-5 py-3 rounded-md hover:bg-ink/90"
        >
          Open the live dashboard — no sign-up required
        </Link>
        <p className="text-xs text-[#3a4a41]/70 mt-8">
          Built for the Agents for Humans Hackathon. Demo data — see agents/README.md in the repo for what's
          verified live versus stubbed pending AWS account access.
        </p>
      </footer>
    </div>
  );
}

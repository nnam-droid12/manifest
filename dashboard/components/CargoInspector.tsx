"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";

type Phase = "idle" | "scanning" | "revealed";

interface Region {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  delayMs: number;
}

// Percentages derived directly from the pixel coordinates Pillow draws at in
// agents/scripts/generate_demo_cargo_photos.py, on a 640x480 canvas — not
// eyeballed against the rendered image.
const REGIONS: Region[] = [
  { id: "crushed-box", label: "Crushed top flap", left: 23.44, top: 25.0, width: 28.13, height: 25.0, delayMs: 0 },
  { id: "torn-flap", label: "Torn flap, contents exposed", left: 23.44, top: 54.17, width: 9.38, height: 16.67, delayMs: 450 },
  { id: "puncture", label: "New puncture mark", left: 65.63, top: 62.5, width: 7.81, height: 8.33, delayMs: 900 },
];

const VERDICT_TEXT =
  "Given two photos of the same pallet (matched via the BOL REF-88213 marker visible in both), the " +
  "multimodal model found the same shipment intact at pickup and identified two real changes at " +
  "delivery: a torn/crushed top flap on the left box exposing its contents, and a new circular " +
  "puncture mark on the right box that wasn't present before. Re-run against a clean pair (same " +
  "photo twice) correctly reported \"condition match — no discrepancy\" rather than manufacturing a " +
  "finding — confirms this isn't a model that flags damage by default regardless of input.";

function PhotoPane({
  src,
  label,
  showRegions,
  scanning,
}: {
  src: string;
  label: string;
  showRegions: boolean;
  scanning: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${label} cargo photo`} className="w-full h-auto block select-none" draggable={false} />
        {scanning && (
          <div
            className="absolute left-0 right-0 h-10 pointer-events-none cargo-scan-line"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(99,102,241,0.55), transparent)",
            }}
          />
        )}
        {showRegions &&
          REGIONS.map((r) => (
            <div
              key={r.id}
              className="absolute border-2 border-red-500 rounded-sm cargo-highlight pointer-events-none"
              style={{
                left: `${r.left}%`,
                top: `${r.top}%`,
                width: `${r.width}%`,
                height: `${r.height}%`,
                animationDelay: `${r.delayMs}ms, ${r.delayMs + 300}ms`,
                opacity: 0,
              }}
            >
              <span
                className="absolute -top-6 left-0 whitespace-nowrap text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded"
                style={{ opacity: 0, animation: `cargo-highlight-in-kf 0.3s ease-out ${r.delayMs}ms forwards` }}
              >
                {r.label}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function CargoInspector() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [runKey, setRunKey] = useState(0);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  function runReplay() {
    setLiveMessage(null);
    setPhase("scanning");
    setRunKey((k) => k + 1);
    window.setTimeout(() => setPhase("revealed"), 1500);
  }

  function tryLive() {
    setLiveMessage(
      "Live analysis calls Bedrock Mantle directly — currently returning account-wide outage errors " +
        "(tracked in agentcore-deploy/README.md). Showing the last verified real agent run instead, not a placeholder."
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Cargo Condition Agent — pickup vs. delivery</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Load 1002 · Replaying a real, verified agent run (synthetic Pillow-drawn test photos, matched on BOL REF-88213)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={tryLive}
            className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50"
          >
            Try live analysis
          </button>
          <button
            onClick={runReplay}
            disabled={phase === "scanning"}
            className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 disabled:opacity-50"
          >
            {phase === "idle" ? "▶ Run inspection" : "▶ Replay inspection"}
          </button>
        </div>
      </div>

      {liveMessage && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {liveMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4" key={runKey}>
        <PhotoPane src="/cargo/pickup.png" label="Pickup" showRegions={false} scanning={false} />
        <PhotoPane
          src="/cargo/delivery.png"
          label="Delivery"
          showRegions={phase === "revealed"}
          scanning={phase === "scanning"}
        />
      </div>

      {phase === "scanning" && (
        <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          Comparing photos against reference marker, checking for condition discrepancies…
        </div>
      )}

      {phase === "revealed" && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="danger">DISCREPANCY FOUND</Badge>
            <span className="text-xs text-slate-400 font-mono">compare_cargo_photos()</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{VERDICT_TEXT}</p>
        </div>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

// The DCV web client touches `window` at module load time, and pulls in a
// genuinely heavy SDK -- loaded client-only, and only once the page is
// actually visited, so it never weighs down other pages.
const LiveInvestigation = dynamic(() => import("@/components/LiveInvestigation"), {
  ssr: false,
  loading: () => <div className="text-sm text-slate-400">Loading live investigation…</div>,
});

export default function LiveInvestigationLoader() {
  return <LiveInvestigation />;
}

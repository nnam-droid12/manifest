"use client";

import dynamic from "next/dynamic";

// Uses the browser's Web Speech API, which only exists on `window` -- loaded
// client-only, and only once the page is actually visited.
const LiveInvestigation = dynamic(() => import("@/components/LiveInvestigation"), {
  ssr: false,
  loading: () => <div className="text-sm text-slate-400">Loading live investigation…</div>,
});

export default function LiveInvestigationLoader() {
  return <LiveInvestigation />;
}

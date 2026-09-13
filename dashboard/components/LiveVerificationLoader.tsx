"use client";

import dynamic from "next/dynamic";

// The DCV web client touches `window` at module load time, and pulls in a
// genuinely heavy SDK -- loaded client-only, and only once a verification is
// actually requested, so it never weighs down the Approvals page itself.
const LiveVerification = dynamic(() => import("@/components/LiveVerification"), {
  ssr: false,
  loading: () => <div className="text-xs text-slate-400 mt-3">Loading live verification…</div>,
});

export default function LiveVerificationLoader(props: { mcNumber: string; carrierName: string }) {
  return <LiveVerification {...props} />;
}

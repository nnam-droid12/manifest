"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at module load time, so it can't run during
// static-export prerendering on the server — loaded client-only.
const LiveTrackingMap = dynamic(() => import("@/components/LiveTrackingMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-[500px] flex items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export default function LiveTrackingMapLoader() {
  return <LiveTrackingMap />;
}

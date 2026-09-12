"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import Link from "next/link";
import { auditTrail } from "@/lib/demo-data";
import { Badge } from "@/components/ui";

type LatLng = [number, number];

const CHICAGO: LatLng = [41.8781, -87.6298];
const NASHVILLE: LatLng = [36.1627, -86.7816];
const KNOXVILLE: LatLng = [35.9606, -83.9207];
const ATLANTA: LatLng = [33.749, -84.388];

// Both routes are real waypoints on the I-24/I-75 Chicago -> Atlanta corridor.
// The two scenarios below are two SEPARATE real agent runs on SHP-3001 (a6,
// a7, a12 in the audit trail) — not one continuous trip that both happened
// on. Shown as a toggle, not spliced into one story, to keep that honest.
const ROUTES: Record<"on-schedule" | "breakdown", { waypoints: LatLng[]; stopAt: number }> = {
  "on-schedule": { waypoints: [CHICAGO, NASHVILLE, ATLANTA], stopAt: 2 },
  breakdown: { waypoints: [CHICAGO, KNOXVILLE], stopAt: 1 },
};

const TRACE = auditTrail.find((e) => e.id === "a6")!;
const CUSTOMER_UPDATE = auditTrail.find((e) => e.id === "a7")!;
const VOICE = auditTrail.find((e) => e.id === "a12")!;

function interpolateRoute(waypoints: LatLng[], stepsPerLeg: number): LatLng[] {
  const points: LatLng[] = [];
  for (let leg = 0; leg < waypoints.length - 1; leg++) {
    const [lat1, lng1] = waypoints[leg];
    const [lat2, lng2] = waypoints[leg + 1];
    for (let s = 0; s <= stepsPerLeg; s++) {
      const t = s / stepsPerLeg;
      points.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
    }
  }
  return points;
}

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🚚</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function pinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

type Scenario = "on-schedule" | "breakdown";
type Phase = "idle" | "running" | "arrived" | "broken-down";

export default function LiveTrackingMap() {
  const [scenario, setScenario] = useState<Scenario>("breakdown");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState<LatLng>(CHICAGO);
  const intervalRef = useRef<number | null>(null);

  const path = useMemo(() => interpolateRoute(ROUTES[scenario].waypoints, 40), [scenario]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  function run() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setPhase("running");
    setPos(CHICAGO);
    let i = 0;
    intervalRef.current = window.setInterval(() => {
      i += 1;
      if (i >= path.length) {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        setPos(path[path.length - 1]);
        setPhase(scenario === "breakdown" ? "broken-down" : "arrived");
        return;
      }
      setPos(path[i]);
    }, 90);
  }

  const destination = scenario === "breakdown" ? KNOXVILLE : ATLANTA;
  const destinationLabel = scenario === "breakdown" ? "Knoxville, TN (breakdown reported here)" : "Atlanta, GA";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Live Tracking — Shipment SHP-3001</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chicago, IL → Atlanta, GA · replaying two real, separate agent-verified check-ins on this shipment
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => {
                setScenario("breakdown");
                setPhase("idle");
                setPos(CHICAGO);
              }}
              className={`px-3 py-1.5 ${scenario === "breakdown" ? "bg-ink text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Breakdown scenario
            </button>
            <button
              onClick={() => {
                setScenario("on-schedule");
                setPhase("idle");
                setPos(CHICAGO);
              }}
              className={`px-3 py-1.5 border-l border-slate-200 ${scenario === "on-schedule" ? "bg-ink text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              On-schedule scenario
            </button>
          </div>
          <button
            onClick={run}
            disabled={phase === "running"}
            className="text-xs font-medium bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink/90 disabled:opacity-50"
          >
            {phase === "idle" ? "▶ Track shipment" : phase === "running" ? "Tracking…" : "▶ Replay"}
          </button>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-200" style={{ height: 420 }}>
        <MapContainer center={[38.5, -85.5]} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={path} pathOptions={{ color: "#1b4332", weight: 3, opacity: 0.6 }} />
          <Marker position={CHICAGO} icon={pinIcon("#1b4332")}>
            <Popup>Pickup — Chicago, IL</Popup>
          </Marker>
          <Marker position={destination} icon={pinIcon(scenario === "breakdown" ? "#ef4444" : "#1b4332")}>
            <Popup>{destinationLabel}</Popup>
          </Marker>
          {scenario === "on-schedule" && (
            <Marker position={NASHVILLE} icon={pinIcon("#94a3b8")}>
              <Popup>Nashville, TN — checkpoint</Popup>
            </Marker>
          )}
          <Marker position={pos} icon={truckIcon} />
        </MapContainer>
      </div>

      {phase !== "idle" && (
        <div className="mt-4 space-y-3">
          {phase === "running" && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-ink animate-ping" />
              Voice Check-In Agent placing a status call…
            </div>
          )}

          {phase === "broken-down" && (
            <>
              <div className="border border-red-200 bg-red-50/50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium text-slate-900">{VOICE.agent}</div>
                  <Badge tone="danger">BREAKDOWN REPORTED</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{VOICE.reasoning}</p>
              </div>
              <div className="border border-amber-200 bg-amber-50/50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium text-slate-900">{TRACE.agent}</div>
                  <Badge tone="warning">ESCALATED</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{TRACE.reasoning}</p>
              </div>
              <div className="border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium text-slate-900">{CUSTOMER_UPDATE.agent}</div>
                  <Badge tone="success">DRAFTED</Badge>
                </div>
                <div className="text-sm text-slate-700 mt-1">{CUSTOMER_UPDATE.summary}</div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{CUSTOMER_UPDATE.reasoning}</p>
              </div>
              <Link href="/audit" className="text-xs font-medium text-ink hover:underline inline-block">
                See the full audit trail →
              </Link>
            </>
          )}

          {phase === "arrived" && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium text-slate-900">{VOICE.agent} + {TRACE.agent}</div>
                <Badge tone="success">ON SCHEDULE</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Real Amazon Polly + Transcribe check-in call: &ldquo;just passed Nashville, should be in
                Atlanta by tomorrow morning&rdquo; — matched against the promised delivery date and correctly
                logged as on track, no escalation needed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

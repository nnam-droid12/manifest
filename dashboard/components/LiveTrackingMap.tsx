"use client";

import "leaflet/dist/leaflet.css";
import { useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import { Badge } from "@/components/ui";

type LatLng = [number, number];

const CHICAGO: LatLng = [41.8781, -87.6298];
const ATLANTA: LatLng = [33.749, -84.388];
const AVG_SPEED_MPH = 55;
// Load 1002's real promised delivery date from demo-data.ts.
const PROMISED_DELIVERY = new Date("2026-09-07T17:00:00Z");

const SEVERITIES = [
  { id: "minor", label: "Minor delay", hours: 1, detail: "e.g. a short traffic slowdown" },
  { id: "moderate", label: "Moderate delay", hours: 4, detail: "e.g. a mechanical issue, repaired on-site" },
  { id: "severe", label: "Severe delay", hours: 12, detail: "e.g. a breakdown requiring a tow and reload" },
] as const;

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatEta(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">🚚</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#1b4332;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const incidentIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">⚠️</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 22],
});

function ClickCatcher({ onClick, disabled }: { onClick: (pos: LatLng) => void; disabled: boolean }) {
  useMapEvents({
    click(e) {
      if (!disabled) onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

type Status = "idle" | "geocoding" | "picked";

export default function LiveTrackingMap() {
  const [incident, setIncident] = useState<LatLng | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [severityId, setSeverityId] = useState<(typeof SEVERITIES)[number]["id"] | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  async function handleMapClick(pos: LatLng) {
    setIncident(pos);
    setSeverityId(null);
    setPlaceName(null);
    setGeocodeError(null);
    setStatus("geocoding");
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}&zoom=10`,
        { headers: { Accept: "application/json" } }
      );
      const data = await resp.json();
      const addr = data.address || {};
      const name =
        addr.city || addr.town || addr.village || addr.county || data.display_name?.split(",")[0] || "this location";
      const region = addr.state || addr.country || "";
      setPlaceName(region ? `${name}, ${region}` : name);
    } catch {
      setGeocodeError("Couldn't reach the free reverse-geocoding service — showing coordinates instead.");
      setPlaceName(`${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}`);
    }
    setStatus("picked");
  }

  function reset() {
    setIncident(null);
    setPlaceName(null);
    setSeverityId(null);
    setStatus("idle");
    setGeocodeError(null);
  }

  const severity = SEVERITIES.find((s) => s.id === severityId) || null;

  let computed: {
    coveredMiles: number;
    remainingMiles: number;
    directMiles: number;
    detourHours: number;
    totalDelayHours: number;
    newEta: Date;
  } | null = null;

  if (incident && severity) {
    const coveredMiles = haversineMiles(CHICAGO, incident);
    const remainingMiles = haversineMiles(incident, ATLANTA);
    const directMiles = haversineMiles(CHICAGO, ATLANTA);
    const detourHours = Math.max(0, (coveredMiles + remainingMiles - directMiles) / AVG_SPEED_MPH);
    const totalDelayHours = severity.hours + detourHours;
    const newEta = new Date(PROMISED_DELIVERY.getTime() + totalDelayHours * 60 * 60 * 1000);
    computed = { coveredMiles, remainingMiles, directMiles, detourHours, totalDelayHours, newEta };
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Live Tracking — Shipment SHP-3001</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chicago, IL → Atlanta, GA · click anywhere on the map to simulate a disruption there and see the agent
            compute a real new ETA
          </p>
        </div>
        {incident && (
          <button
            onClick={reset}
            className="text-xs font-medium bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      <div className="rounded-lg overflow-hidden border border-slate-200" style={{ height: 420 }}>
        <MapContainer center={[38.5, -85.5]} zoom={6} scrollWheelZoom={false} style={{ height: "100%", width: "100%", cursor: "crosshair" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickCatcher onClick={handleMapClick} disabled={status === "geocoding"} />
          <Polyline positions={[CHICAGO, ATLANTA]} pathOptions={{ color: "#1b4332", weight: 2, opacity: 0.5, dashArray: "1 10" }} />
          {incident && (
            <>
              <Polyline positions={[CHICAGO, incident]} pathOptions={{ color: "#1b4332", weight: 3 }} />
              <Polyline positions={[incident, ATLANTA]} pathOptions={{ color: "#ef4444", weight: 3, dashArray: "6 6" }} />
            </>
          )}
          <Marker position={CHICAGO} icon={pickupIcon}>
            <Tooltip permanent direction="top" offset={[0, -8]} className="!text-[10px] !py-0.5 !px-1.5">
              Chicago
            </Tooltip>
            <Popup>Chicago, IL — pickup</Popup>
          </Marker>
          <Marker position={ATLANTA} icon={pickupIcon}>
            <Tooltip permanent direction="top" offset={[0, -8]} className="!text-[10px] !py-0.5 !px-1.5">
              Atlanta
            </Tooltip>
            <Popup>Atlanta, GA — delivery</Popup>
          </Marker>
          {incident && (
            <Marker position={incident} icon={incidentIcon}>
              <Popup>{placeName || "Incident location"}</Popup>
            </Marker>
          )}
          {incident && <Marker position={incident} icon={truckIcon} />}
        </MapContainer>
      </div>

      {!incident && (
        <p className="text-xs text-slate-400 mt-3">
          Nothing scripted here — click any point on the map (on the route or off it) and the agent reverse-geocodes
          the real location and recalculates a real ETA from there.
        </p>
      )}

      {status === "geocoding" && (
        <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-ink animate-ping" />
          Looking up that location…
        </div>
      )}

      {incident && status === "picked" && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-sm text-slate-700 mb-2">
            Incident reported near <span className="font-semibold">{placeName}</span>
            {geocodeError && <span className="text-amber-600 text-xs block mt-0.5">{geocodeError}</span>}
          </div>
          {!severity ? (
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                How severe? (this changes the computed ETA below)
              </div>
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeverityId(s.id)}
                    className="text-left text-xs px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-800">
                      {s.label} (+{s.hours}h)
                    </div>
                    <div className="text-slate-400">{s.detail}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            computed && (
              <div className="border border-amber-200 bg-amber-50/50 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm font-medium text-slate-900">Track-and-Trace Agent</div>
                  <Badge tone="warning">RECALCULATED</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {Math.round(computed.coveredMiles)} mi covered from Chicago, {Math.round(computed.remainingMiles)}{" "}
                  mi remaining to Atlanta ({Math.round(computed.directMiles)} mi direct)
                  {computed.detourHours > 0.05 && (
                    <> — being off the direct line adds ~{computed.detourHours.toFixed(1)}h on its own</>
                  )}
                  . At {AVG_SPEED_MPH} mph average and a {severity.label.toLowerCase()} (+{severity.hours}h), new
                  total delay is <span className="font-semibold">{computed.totalDelayHours.toFixed(1)} hours</span>.
                </p>
                <div className="text-sm text-slate-800">
                  New ETA: <span className="font-semibold">{formatEta(computed.newEta)}</span>{" "}
                  <span className="text-slate-400 text-xs">(was {formatEta(PROMISED_DELIVERY)})</span>
                </div>
                <div className="border-t border-amber-200 pt-2 mt-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <div className="text-sm font-medium text-slate-900">Customer Update Agent</div>
                    <Badge tone="success">DRAFTED</Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    &ldquo;Quick update on your shipment: we hit a {severity.label.toLowerCase()} near {placeName}.
                    New expected arrival is {formatEta(computed.newEta)}, about{" "}
                    {computed.totalDelayHours.toFixed(1)} hours later than planned. We'll keep you posted if
                    anything changes.&rdquo;
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

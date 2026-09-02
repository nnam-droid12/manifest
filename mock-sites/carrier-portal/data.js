// In-memory seed data for the mock carrier tracking portal. Not persisted — restarts reset state.

const carriers = [
  {
    username: "swiftline",
    password: "carrier2026",
    company: "Swiftline Freight LLC",
    mcNumber: "MC-512873",
  },
];

const STATUS_STEPS = ["Dispatched", "Picked Up", "In Transit", "Delivered"];

const shipments = [
  {
    id: "SHP-3001",
    carrierUsername: "swiftline",
    origin: "Chicago, IL",
    destination: "Atlanta, GA",
    referenceNumber: "REF-88213",
    statusIndex: 2,
    lastUpdate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    eta: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })(),
    history: [
      { status: "Dispatched", note: "Driver assigned, en route to pickup.", at: hoursAgo(30) },
      { status: "Picked Up", note: "Loaded at shipper dock 4.", at: hoursAgo(24) },
      { status: "In Transit", note: "Passed Indianapolis, IN.", at: hoursAgo(5) },
    ],
  },
  {
    id: "SHP-3002",
    carrierUsername: "swiftline",
    origin: "Dallas, TX",
    destination: "Houston, TX",
    referenceNumber: "REF-88214",
    statusIndex: 3,
    lastUpdate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    eta: new Date().toISOString().slice(0, 10),
    history: [
      { status: "Dispatched", note: "Driver assigned.", at: hoursAgo(10) },
      { status: "Picked Up", note: "Loaded, departing Dallas.", at: hoursAgo(8) },
      { status: "In Transit", note: "On I-45 South.", at: hoursAgo(4) },
      { status: "Delivered", note: "Delivered and signed by receiving.", at: hoursAgo(2) },
    ],
  },
];

function hoursAgo(n) {
  return new Date(Date.now() - 1000 * 60 * 60 * n).toISOString();
}

module.exports = { carriers, shipments, STATUS_STEPS };

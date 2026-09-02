// In-memory seed data for the mock load board. Not persisted — restarts reset state.

const LANES = [
  { origin: "Chicago, IL", destination: "Atlanta, GA", miles: 716 },
  { origin: "Dallas, TX", destination: "Houston, TX", miles: 239 },
  { origin: "Los Angeles, CA", destination: "Phoenix, AZ", miles: 372 },
  { origin: "Memphis, TN", destination: "Charlotte, NC", miles: 615 },
  { origin: "Columbus, OH", destination: "Newark, NJ", miles: 528 },
  { origin: "Denver, CO", destination: "Salt Lake City, UT", miles: 525 },
];

const EQUIPMENT = ["Dry Van", "Reefer", "Flatbed"];
const COMMODITIES = {
  "Dry Van": ["General Freight", "Packaged Goods", "Retail Merchandise"],
  Reefer: ["Produce", "Frozen Foods", "Dairy"],
  Flatbed: ["Steel Coils", "Lumber", "Machinery"],
};

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedLoads() {
  const loads = [];
  let id = 1001;
  LANES.forEach((lane, i) => {
    EQUIPMENT.forEach((equip, j) => {
      const pickupOffset = 1 + ((i + j) % 4);
      const ratePerMile = 1.8 + ((i * 7 + j * 3) % 12) / 10;
      loads.push({
        id: String(id++),
        origin: lane.origin,
        destination: lane.destination,
        miles: lane.miles,
        equipmentType: equip,
        commodity: COMMODITIES[equip][(i + j) % COMMODITIES[equip].length],
        weight: 20000 + ((i * 1300 + j * 500) % 22000),
        pickupDate: daysFromNow(pickupOffset),
        deliveryDate: daysFromNow(pickupOffset + 1 + Math.ceil(lane.miles / 500)),
        rate: Math.round(lane.miles * ratePerMile),
        postedBy: ["Summit Freight Co.", "Northline Logistics", "Cascade Shippers"][
          (i + j) % 3
        ],
        status: "Available",
      });
    });
  });
  return loads;
}

const loads = seedLoads();

const inquiries = [];

const users = [
  { username: "broker1", password: "manifest2026" },
];

module.exports = { loads, inquiries, users };

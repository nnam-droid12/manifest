const express = require("express");
const session = require("express-session");
const path = require("path");
const { carriers, shipments, STATUS_STEPS } = require("./data");

const app = express();
const PORT = process.env.PORT || 4002;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "manifest-mock-carrier-portal",
    resave: false,
    saveUninitialized: false,
  })
);

function requireAuth(req, res, next) {
  if (!req.session.carrier) return res.redirect("/login");
  next();
}

app.get("/", (req, res) => res.redirect(req.session.carrier ? "/shipments" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const carrier = carriers.find((c) => c.username === username && c.password === password);
  if (!carrier) return res.render("login", { error: "Invalid username or password." });
  req.session.carrier = username;
  res.redirect("/shipments");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/shipments", requireAuth, (req, res) => {
  const mine = shipments.filter((s) => s.carrierUsername === req.session.carrier);
  res.render("shipments", { shipments: mine, statusSteps: STATUS_STEPS });
});

app.get("/shipments/:id", requireAuth, (req, res) => {
  const shipment = shipments.find(
    (s) => s.id === req.params.id && s.carrierUsername === req.session.carrier
  );
  if (!shipment) return res.status(404).send("Shipment not found");
  res.render("shipment-detail", { shipment, statusSteps: STATUS_STEPS, updated: false });
});

app.post("/shipments/:id/update", requireAuth, (req, res) => {
  const shipment = shipments.find(
    (s) => s.id === req.params.id && s.carrierUsername === req.session.carrier
  );
  if (!shipment) return res.status(404).send("Shipment not found");
  const newIndex = STATUS_STEPS.indexOf(req.body.status);
  if (newIndex >= 0) {
    shipment.statusIndex = newIndex;
    shipment.lastUpdate = new Date().toISOString();
    shipment.history.push({
      status: req.body.status,
      note: req.body.note || "",
      at: new Date().toISOString(),
    });
  }
  res.render("shipment-detail", { shipment, statusSteps: STATUS_STEPS, updated: true });
});

// Read-only JSON endpoint — this is what the Track-and-Trace Agent's
// browser-automation / API tool polls in place of clicking through pages.
app.get("/api/shipments/:id", requireAuth, (req, res) => {
  const shipment = shipments.find((s) => s.id === req.params.id);
  if (!shipment) return res.status(404).json({ error: "not_found" });
  res.json({ ...shipment, status: STATUS_STEPS[shipment.statusIndex] });
});

app.listen(PORT, () => {
  console.log(
    `Mock carrier portal listening on http://localhost:${PORT} (login: swiftline / carrier2026)`
  );
});

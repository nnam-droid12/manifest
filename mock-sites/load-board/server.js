const express = require("express");
const session = require("express-session");
const path = require("path");
const { loads, inquiries, users } = require("./data");

const app = express();
const PORT = process.env.PORT || 4001;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "manifest-mock-load-board",
    resave: false,
    saveUninitialized: false,
  })
);

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

app.get("/", (req, res) => res.redirect(req.session.user ? "/loads" : "/login"));

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.render("login", { error: "Invalid username or password." });
  req.session.user = username;
  res.redirect("/loads");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/loads", requireAuth, (req, res) => {
  const { origin, destination, equipmentType } = req.query;
  const filtered = loads.filter((l) => {
    if (origin && !l.origin.toLowerCase().includes(origin.toLowerCase())) return false;
    if (destination && !l.destination.toLowerCase().includes(destination.toLowerCase()))
      return false;
    if (equipmentType && l.equipmentType !== equipmentType) return false;
    return true;
  });
  res.render("loads", {
    loads: filtered,
    query: { origin: origin || "", destination: destination || "", equipmentType: equipmentType || "" },
  });
});

app.get("/loads/:id", requireAuth, (req, res) => {
  const load = loads.find((l) => l.id === req.params.id);
  if (!load) return res.status(404).send("Load not found");
  res.render("load-detail", { load, submitted: false });
});

app.post("/loads/:id/inquire", requireAuth, (req, res) => {
  const load = loads.find((l) => l.id === req.params.id);
  if (!load) return res.status(404).send("Load not found");
  inquiries.push({
    loadId: load.id,
    offerRate: req.body.offerRate,
    contactEmail: req.body.contactEmail,
    message: req.body.message,
    submittedAt: new Date().toISOString(),
  });
  res.render("load-detail", { load, submitted: true });
});

app.get("/api/loads", requireAuth, (req, res) => res.json(loads));

app.listen(PORT, () => {
  console.log(`Mock load board listening on http://localhost:${PORT} (login: broker1 / manifest2026)`);
});

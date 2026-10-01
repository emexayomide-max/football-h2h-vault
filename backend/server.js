const express = require("express");
const cors = require("cors");

const h2hRoutes = require("./routes/h2h");
const teamsRoutes = require("./routes/teams");
const competitionsRoutes = require("./routes/competitions");
const seasonsRoutes = require("./routes/seasons");

const app = express();

const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/api/h2h", h2hRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/seasons", seasonsRoutes);

app.get("/", (req, res) => {
  res.json({
    message:
      "Football H2H Vault API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service:
      "football-h2h-vault-api",
  });
});

app.listen(PORT, () => {
  console.log(
    `Football H2H Vault API running on port ${PORT}`
  );
});
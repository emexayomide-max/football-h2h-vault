
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const teamsRouter = require("./routes/teams");
const competitionsRouter = require("./routes/competitions");
const seasonsRouter = require("./routes/seasons");
const fixturesRouter = require("./routes/fixtures");
const teamImportRouter = require("./routes/teamImport");
const matchesRouter = require("./routes/matches");
const h2hRouter = require("./routes/h2h");

const app = express();

const PORT = process.env.PORT || 3001;

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
  res.json({
    status: "success",
    service: "football-h2h-vault-backend",
    message: "Football H2H API is running",
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use("/api/teams", teamsRouter);

app.use(
  "/api/competitions",
  competitionsRouter
);

app.use("/api/seasons", seasonsRouter);

app.use("/api/fixtures", fixturesRouter);

app.use(
  "/api/team-import",
  teamImportRouter
);

app.use("/api/matches", matchesRouter);

app.use("/api/h2h", h2hRouter);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(err.status || 500).json({
    status: "error",
    message:
      err.message || "Internal server error",
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `Football H2H backend running on port ${PORT}`
  );
});

import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import pool from "./db/pool.js";
import accountsRouter from "./routes/accounts.js";
import usersRouter from "./routes/users.js";
import usageRouter from "./routes/usage.js";
import reportsRouter from "./routes/reports.js";
import plansRouter from "./routes/plans.js";

const app = express();

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      database: "connected"
    });
  } catch {
    res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});

app.use("/api/accounts", accountsRouter);
app.use("/api/users", usersRouter);
app.use("/api/usage", usageRouter);
app.use("/api/usage", reportsRouter);
app.use("/api/plans", plansRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: "Invalid JSON body"
    });
    return;
  }

  console.error("Unhandled request error:", err);

  res.status(500).json({
    error: "Internal server error"
  });
};

app.use(errorHandler);

export default app;

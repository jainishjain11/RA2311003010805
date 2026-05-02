"use strict";

require("dotenv").config();

const express = require("express");
const { authenticate } = require("./auth/authService");
const { Log } = require("logging_middleware");
const notificationsRouter = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 4000;

// Body parsing 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware 
app.use((req, _res, next) => {
  Log("backend", "info", "middleware", `Incoming: ${req.method} ${req.originalUrl}`);
  next();
});

// Routes 
app.use("/", notificationsRouter);

// 404 handler 
app.use((req, res) => {
  Log("backend", "warn", "middleware", `404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, error: "Route not found." });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  Log("backend", "fatal", "middleware", `Unhandled exception: ${err.message}`);
  res.status(500).json({ success: false, error: "Internal server error." });
});

// Bootstrap 
(async () => {
  try {
    await Log("backend", "info", "config", "Campus Notifications Service starting up…");

    await authenticate();
    await Log("backend", "info", "auth", "Authentication successful – Bearer token acquired");

    app.listen(PORT, () => {
      Log("backend", "info", "config", `Server listening on port ${PORT}`);
    });
  } catch (err) {
    await Log("backend", "fatal", "config", `Startup failed: ${err.message}`);
    process.exit(1);
  }
})();

import express from "express";
import notificationRoutes from "./route/notificationRoutes";
import { Log } from "./utils/logger";

const app = express();

app.use(express.json());

// Request logging middleware
app.use(async (req, _res, next) => {
  await Log("backend", "debug", "middleware", `Incoming: ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Routes
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/health", async (_req, res) => {
  await Log("backend", "info", "route", "Health check endpoint hit");
  res.status(200).json({ status: "ok", service: "notification-app-be" });
});

// 404 handler
app.use(async (req, res) => {
  await Log("backend", "warn", "middleware", `404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, error: "Route not found" });
});

export default app;

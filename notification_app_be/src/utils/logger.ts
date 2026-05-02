/**
 * Logger utility - wraps the Affordmed Logging Middleware for the Notification service.
 */
import { config } from "../config";

type Stack = "backend" | "frontend";
type Level = "debug" | "info" | "warn" | "error" | "fatal";
type Package =
  | "cache" | "controller" | "cron_job" | "db" | "domain"
  | "handler" | "repository" | "route" | "service"
  | "auth" | "config" | "middleware" | "utils";

export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<void> {
  if (!config.accessToken) {
    console.error("[Logger] ACCESS_TOKEN not configured.");
    return;
  }

  try {
    const response = await fetch(`${config.baseURL}/evaluation-service/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({ stack, level, package: pkg, message }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Logger] Log rejected - HTTP ${response.status}: ${body}`);
    }
  } catch (err) {
    console.error("[Logger] Network error sending log:", err);
  }
}

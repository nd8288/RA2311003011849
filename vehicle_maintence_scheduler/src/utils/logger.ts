/**
 * Logger utility - wraps the Affordmed Logging Middleware
 * All log calls route through this to ensure consistent structured logging.
 */
import { config } from "../config";

type Stack = "backend" | "frontend";
type Level = "debug" | "info" | "warn" | "error" | "fatal";
type Package =
  | "cache" | "controller" | "cron_job" | "db" | "domain"
  | "handler" | "repository" | "route" | "service"
  | "auth" | "config" | "middleware" | "utils";

/**
 * Log - Sends a structured log to the Affordmed Test Server.
 * @param stack   - Application stack: "backend" | "frontend"
 * @param level   - Log level: "debug" | "info" | "warn" | "error" | "fatal"
 * @param pkg     - Package/layer name
 * @param message - Descriptive log message
 */
export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<void> {
  if (!config.accessToken) {
    console.error("[Logger] ACCESS_TOKEN not set. Cannot send log.");
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
    console.error("[Logger] Failed to send log to server:", err);
  }
}

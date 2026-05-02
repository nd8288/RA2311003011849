/**
 * Affordmed Logging Middleware
 * A reusable logging package that sends structured logs to the Affordmed Test Server.
 * Supports both backend and frontend stacks.
 */

type Stack = "backend" | "frontend";
type Level = "debug" | "info" | "warn" | "error" | "fatal";

type BackendPackage =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service";

type FrontendPackage = "api" | "component" | "hook" | "page" | "state" | "style";

type SharedPackage = "auth" | "config" | "middleware" | "utils";

type Package = BackendPackage | FrontendPackage | SharedPackage;

interface LogPayload {
  stack: Stack;
  level: Level;
  package: Package;
  message: string;
}

interface LogResponse {
  logID: string;
  message: string;
}

interface LoggerConfig {
  baseURL: string;
  accessToken: string;
}

let loggerConfig: LoggerConfig = {
  baseURL: "http://20.207.122.201",
  accessToken: "",
};

/**
 * Initialize the logger with the access token obtained from Affordmed auth endpoint.
 * Must be called before using the Log function.
 */
export function initLogger(accessToken: string, baseURL?: string): void {
  loggerConfig.accessToken = accessToken;
  if (baseURL) {
    loggerConfig.baseURL = baseURL;
  }
  console.log("[Logger] Logger initialized successfully.");
}

/**
 * Core Log function - sends a structured log entry to the Affordmed Test Server.
 *
 * @param stack   - "backend" | "frontend"
 * @param level   - "debug" | "info" | "warn" | "error" | "fatal"
 * @param pkg     - The package/layer in your application (e.g. "service", "controller", "db")
 * @param message - Descriptive message about what is happening at this point in the code
 *
 * @example
 * Log("backend", "info", "service", "UserService: Fetching user profile for userID=42")
 * Log("backend", "error", "db", "Database connection pool exhausted, retrying in 5s")
 * Log("frontend", "warn", "component", "NotificationList: Empty notifications array received")
 */
export async function Log(
  stack: Stack,
  level: Level,
  pkg: Package,
  message: string
): Promise<LogResponse | null> {
  if (!loggerConfig.accessToken) {
    console.error(
      "[Logger] ERROR: Logger not initialized. Call initLogger(accessToken) before using Log()."
    );
    return null;
  }

  const payload: LogPayload = {
    stack,
    level,
    package: pkg,
    message,
  };

  try {
    const response = await fetch(
      `${loggerConfig.baseURL}/evaluation-service/logs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loggerConfig.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Logger] Failed to send log. Status: ${response.status}, Body: ${errorText}`
      );
      return null;
    }

    const data: LogResponse = await response.json();
    return data;
  } catch (err) {
    console.error("[Logger] Network error while sending log:", err);
    return null;
  }
}

export default Log;

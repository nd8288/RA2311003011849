import { config } from "../config";
import { Log } from "../utils/logger";
import { Notification, NotificationAPIResponse } from "../domain/types";

/**
 * Fetches all notifications from the Affordmed evaluation service.
 * This is the single source of truth - no DB storage needed per the spec.
 */
export async function fetchNotifications(): Promise<Notification[]> {
  await Log("backend", "info", "repository", "fetchNotifications: Initiating GET /evaluation-service/notifications");

  try {
    const response = await fetch(`${config.baseURL}/evaluation-service/notifications`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      await Log("backend", "error", "repository", `fetchNotifications: API returned HTTP ${response.status} - ${errBody}`);
      throw new Error(`Notifications API error: HTTP ${response.status}`);
    }

    const data = await response.json() as NotificationAPIResponse;

    await Log("backend", "info", "repository", `fetchNotifications: Successfully fetched ${data.notifications.length} notifications`);

    return data.notifications;
  } catch (err) {
    await Log("backend", "fatal", "repository", `fetchNotifications: Critical failure - ${String(err)}`);
    throw err;
  }
}

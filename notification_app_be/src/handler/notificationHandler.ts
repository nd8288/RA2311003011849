import { Request, Response } from "express";
import { Log } from "../utils/logger";
import {
  getAllNotifications,
  getNotificationsByType,
  getTopNNotifications,
  bulkNotify,
} from "../service/notificationService";
import { NotificationType } from "../domain/types";
import { invalidateCache } from "../cache/notificationCache";
import { getConnectedClientCount } from "../middleware/websocketManager";

/**
 * GET /api/notifications
 * Returns all notifications (with caching).
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  await Log("backend", "info", "handler", `getNotifications: Request from ${req.ip}`);

  try {
    const notifications = await getAllNotifications();

    await Log("backend", "info", "handler", `getNotifications: Returning ${notifications.length} notifications`);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `getNotifications: Failed - ${String(err)}`);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
}

/**
 * GET /api/notifications/type/:type
 * Returns notifications filtered by type (Event | Result | Placement).
 */
export async function getByType(req: Request, res: Response): Promise<void> {
  const type = req.params.type as NotificationType;

  await Log("backend", "info", "handler", `getByType: Request for type="${type}"`);

  const validTypes: NotificationType[] = ["Event", "Result", "Placement"];
  if (!validTypes.includes(type)) {
    await Log("backend", "warn", "handler", `getByType: Invalid notification type="${type}"`);
    res.status(400).json({
      success: false,
      error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
    });
    return;
  }

  try {
    const notifications = await getNotificationsByType(type);

    await Log("backend", "info", "handler", `getByType: Returning ${notifications.length} notifications for type="${type}"`);

    res.status(200).json({
      success: true,
      type,
      count: notifications.length,
      notifications,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `getByType: Error for type="${type}" - ${String(err)}`);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
}

/**
 * GET /api/notifications/priority
 * Stage 6: Returns top N priority notifications.
 * Query param: ?n=10 (default: 10)
 */
export async function getPriorityNotifications(req: Request, res: Response): Promise<void> {
  const n = parseInt(req.query.n as string) || 10;

  await Log("backend", "info", "handler", `getPriorityNotifications: Request for top ${n} priority notifications`);

  if (n <= 0 || n > 100) {
    await Log("backend", "warn", "handler", `getPriorityNotifications: Invalid n=${n}, must be 1-100`);
    res.status(400).json({ success: false, error: "n must be between 1 and 100" });
    return;
  }

  try {
    const topNotifications = await getTopNNotifications(n);

    await Log("backend", "info", "handler", `getPriorityNotifications: Returning ${topNotifications.length} priority notifications`);

    res.status(200).json({
      success: true,
      requestedTop: n,
      returnedCount: topNotifications.length,
      priorityOrder: "Placement > Result > Event, then by recency",
      notifications: topNotifications,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `getPriorityNotifications: Error - ${String(err)}`);
    res.status(500).json({ success: false, error: "Failed to compute priority notifications" });
  }
}

/**
 * POST /api/notifications/bulk-notify
 * Stage 5: Send notification to multiple students.
 * Body: { studentIDs: string[], message: string }
 */
export async function postBulkNotify(req: Request, res: Response): Promise<void> {
  const { studentIDs, message } = req.body as { studentIDs: string[]; message: string };

  await Log("backend", "info", "handler", `postBulkNotify: Bulk notify request for ${studentIDs?.length} students`);

  if (!Array.isArray(studentIDs) || studentIDs.length === 0) {
    await Log("backend", "warn", "handler", "postBulkNotify: Invalid or empty studentIDs array");
    res.status(400).json({ success: false, error: "studentIDs must be a non-empty array" });
    return;
  }

  if (!message || typeof message !== "string") {
    await Log("backend", "warn", "handler", "postBulkNotify: Missing or invalid message field");
    res.status(400).json({ success: false, error: "message is required and must be a string" });
    return;
  }

  try {
    const result = await bulkNotify(studentIDs, message);

    await Log(
      "backend",
      "info",
      "handler",
      `postBulkNotify: Completed - success=${result.successCount}, failed=${result.failedStudents.length}`
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `postBulkNotify: Fatal error - ${String(err)}`);
    res.status(500).json({ success: false, error: "Bulk notify failed" });
  }
}

/**
 * POST /api/notifications/cache/invalidate
 * Stage 4: Manually invalidate the notification cache.
 */
export async function postInvalidateCache(req: Request, res: Response): Promise<void> {
  await Log("backend", "info", "handler", "postInvalidateCache: Cache invalidation requested");

  try {
    await invalidateCache("all_notifications");
    res.status(200).json({ success: true, message: "Cache invalidated successfully" });
  } catch (err) {
    await Log("backend", "error", "handler", `postInvalidateCache: Error - ${String(err)}`);
    res.status(500).json({ success: false, error: "Cache invalidation failed" });
  }
}

/**
 * GET /api/notifications/ws/status
 * Returns WebSocket connection stats.
 */
export async function getWsStatus(req: Request, res: Response): Promise<void> {
  const connectedClients = getConnectedClientCount();
  await Log("backend", "info", "handler", `getWsStatus: ${connectedClients} active WebSocket connections`);

  res.status(200).json({
    success: true,
    connectedClients,
    wsEndpoint: "ws://localhost:3002/ws?studentID=<your_id>",
  });
}

import { Router } from "express";
import {
  getNotifications,
  getByType,
  getPriorityNotifications,
  postBulkNotify,
  postInvalidateCache,
  getWsStatus,
} from "../handler/notificationHandler";

const router = Router();

/**
 * GET /api/notifications
 * Fetch all notifications (cached, Stage 4).
 * Response: { success, count, notifications }
 */
router.get("/", getNotifications);

/**
 * GET /api/notifications/priority?n=10
 * Stage 6: Top N priority notifications (Placement > Result > Event, then recency).
 * Response: { success, requestedTop, returnedCount, priorityOrder, notifications }
 */
router.get("/priority", getPriorityNotifications);

/**
 * GET /api/notifications/ws/status
 * Returns current WebSocket connection count.
 * Response: { success, connectedClients, wsEndpoint }
 */
router.get("/ws/status", getWsStatus);

/**
 * GET /api/notifications/type/:type
 * Filter notifications by type: Event | Result | Placement.
 * Response: { success, type, count, notifications }
 */
router.get("/type/:type", getByType);

/**
 * POST /api/notifications/bulk-notify
 * Stage 5: Send notification to multiple students.
 * Body: { studentIDs: string[], message: string }
 * Response: { success, successCount, failedStudents, dbSaved }
 */
router.post("/bulk-notify", postBulkNotify);

/**
 * POST /api/notifications/cache/invalidate
 * Stage 4: Invalidate the in-memory notification cache.
 * Response: { success, message }
 */
router.post("/cache/invalidate", postInvalidateCache);

export default router;

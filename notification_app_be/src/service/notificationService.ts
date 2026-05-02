import { Log } from "../utils/logger";
import { Notification, PrioritizedNotification, NotificationType, TYPE_WEIGHT } from "../domain/types";
import { fetchNotifications } from "../repository/notificationRepository";
import { getCached, setCached } from "../cache/notificationCache";

const CACHE_KEY = "all_notifications";

/**
 * Retrieves all notifications with caching (Stage 4 optimization).
 * First checks cache, falls back to API call on miss.
 */
export async function getAllNotifications(): Promise<Notification[]> {
  await Log("backend", "info", "service", "NotificationService: getAllNotifications called");

  // Stage 4: Check cache first to avoid hammering the data source
  const cached = await getCached(CACHE_KEY);
  if (cached) {
    await Log("backend", "info", "service", `NotificationService: Returning ${cached.length} notifications from cache`);
    return cached;
  }

  // Cache miss - fetch from API
  await Log("backend", "info", "service", "NotificationService: Cache miss, fetching from API");
  const notifications = await fetchNotifications();

  // Store in cache for subsequent requests
  await setCached(CACHE_KEY, notifications);

  return notifications;
}

/**
 * Filters notifications by type.
 */
export async function getNotificationsByType(type: NotificationType): Promise<Notification[]> {
  await Log("backend", "info", "service", `NotificationService: getNotificationsByType called with type="${type}"`);

  const all = await getAllNotifications();
  const filtered = all.filter((n) => n.Type === type);

  await Log("backend", "debug", "service", `NotificationService: Filtered ${filtered.length}/${all.length} notifications for type="${type}"`);

  return filtered;
}

/**
 * Stage 6: Priority Inbox - Returns top N notifications by priority score.
 *
 * Priority is determined by:
 * 1. Type weight: Placement (3) > Result (2) > Event (1)
 * 2. Recency: More recent notifications rank higher within the same type
 *
 * Algorithm:
 * - Compute a priority score = typeWeight * 1e13 + timestampMs
 *   (This ensures type always dominates, with recency as tiebreaker)
 * - Sort descending by score
 * - Return top N
 *
 * To maintain top N efficiently as new notifications stream in:
 * - We use a max-heap concept via sort + slice (O(n log n))
 * - For real-time streaming, a min-heap of size N would be O(n log N)
 *   but sort+slice is simpler and fast enough for this scale
 *
 * @param n - Number of top-priority notifications to return (default 10)
 */
export async function getTopNNotifications(n: number = 10): Promise<PrioritizedNotification[]> {
  await Log("backend", "info", "service", `NotificationService: getTopNNotifications called, n=${n}`);

  const all = await getAllNotifications();

  if (all.length === 0) {
    await Log("backend", "warn", "service", "NotificationService: No notifications available for priority ranking");
    return [];
  }

  // Compute priority score for each notification
  const scored: PrioritizedNotification[] = all.map((n) => {
    const typeWeight = TYPE_WEIGHT[n.Type] ?? 0;
    const timestampMs = new Date(n.Timestamp).getTime();
    // typeWeight shifts to a very high magnitude so it always dominates recency
    const priorityScore = typeWeight * 1e13 + timestampMs;
    return { ...n, priorityScore };
  });

  // Sort descending by priority score
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  const topN = scored.slice(0, n);

  await Log(
    "backend",
    "info",
    "service",
    `NotificationService: Returning top ${topN.length} of ${all.length} notifications by priority`
  );

  return topN;
}

/**
 * Stage 5: Bulk Notify - Sends notifications to all students.
 *
 * This is a redesigned version of the naive implementation.
 *
 * Problem with naive implementation:
 * - Sequential: send_email → save_to_db → push_to_app for EACH student
 * - If send_email fails for student #200, students 1-199 got emails but no DB record
 * - No retry mechanism, no partial failure handling
 * - All three operations are tightly coupled
 *
 * Redesigned approach:
 * 1. Save to DB FIRST (as a batch) - this is the source of truth
 * 2. Emit real-time push notifications via WebSocket (fast, non-blocking)
 * 3. Queue email sending asynchronously via a job queue
 * 4. Failed emails are retried independently without affecting DB/push
 *
 * In this implementation, we simulate the logic with proper error handling.
 */
export async function bulkNotify(
  studentIDs: string[],
  message: string
): Promise<{
  successCount: number;
  failedStudents: string[];
  dbSaved: boolean;
}> {
  await Log(
    "backend",
    "info",
    "service",
    `BulkNotifyService: Starting bulk notify for ${studentIDs.length} students, message="${message}"`
  );

  const failedStudents: string[] = [];
  let successCount = 0;
  let dbSaved = false;

  // Step 1: Batch save to DB first (source of truth)
  try {
    await Log("backend", "info", "db", `BulkNotifyService: Saving notification to DB for ${studentIDs.length} students`);
    // Simulated batch DB insert - in real impl, this is a single INSERT with all studentIDs
    dbSaved = true;
    await Log("backend", "info", "db", "BulkNotifyService: DB batch insert successful");
  } catch (dbErr) {
    await Log("backend", "fatal", "db", `BulkNotifyService: DB batch insert FAILED - ${String(dbErr)}`);
    // Do NOT proceed if DB save failed - data integrity must be maintained
    throw new Error("DB insert failed - aborting bulk notify");
  }

  // Step 2 & 3: Send push + queue email per student (these are async/independent)
  for (const studentID of studentIDs) {
    try {
      // Push notification (real-time via WebSocket - fast)
      await Log("backend", "debug", "service", `BulkNotifyService: Pushing real-time notification to studentID=${studentID}`);
      // wsManager.broadcastToStudent(studentID, message); // WebSocket push

      // Email is queued, not sent inline - failures don't affect the loop
      await Log("backend", "debug", "service", `BulkNotifyService: Email queued for studentID=${studentID}`);
      // emailQueue.enqueue(studentID, message); // Non-blocking queue

      successCount++;
    } catch (err) {
      await Log("backend", "error", "service", `BulkNotifyService: Failed to notify studentID=${studentID} - ${String(err)}`);
      failedStudents.push(studentID);
    }
  }

  await Log(
    "backend",
    "info",
    "service",
    `BulkNotifyService: Completed. Success=${successCount}, Failed=${failedStudents.length}, DBSaved=${dbSaved}`
  );

  return { successCount, failedStudents, dbSaved };
}

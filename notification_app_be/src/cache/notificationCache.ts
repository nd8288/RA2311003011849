/**
 * In-Memory Cache for Notifications
 *
 * Stage 4 Solution: The DB was being overwhelmed by fetching notifications
 * on every page load. This cache layer reduces repeated API/DB calls by
 * storing results in memory with a TTL (Time-To-Live).
 *
 * Trade-offs:
 * - PRO: Drastically reduces latency and load on the data source
 * - PRO: Simple to implement, no external dependencies
 * - CON: Data can be stale up to TTL seconds
 * - CON: Cache is lost on server restart (use Redis for persistence)
 * - CON: Does not scale horizontally (each instance has its own cache)
 */
import { Log } from "../utils/logger";
import { Notification } from "../domain/types";

interface CacheEntry {
  data: Notification[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Get cached notifications for a given cache key.
 * Returns null if cache miss or expired.
 */
export async function getCached(key: string): Promise<Notification[] | null> {
  const entry = cache.get(key);

  if (!entry) {
    await Log("backend", "debug", "cache", `Cache MISS for key="${key}" - no entry found`);
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    await Log("backend", "debug", "cache", `Cache MISS for key="${key}" - entry expired`);
    return null;
  }

  await Log("backend", "debug", "cache", `Cache HIT for key="${key}" - returning ${entry.data.length} cached notifications`);
  return entry.data;
}

/**
 * Store notifications in cache with optional TTL.
 */
export async function setCached(
  key: string,
  data: Notification[],
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  await Log("backend", "info", "cache", `Cache SET for key="${key}" - stored ${data.length} notifications, TTL=${ttlMs}ms`);
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const existed = cache.has(key);
  cache.delete(key);
  await Log("backend", "info", "cache", `Cache INVALIDATED for key="${key}" (existed=${existed})`);
}

/**
 * Clear the entire cache.
 */
export async function clearAllCache(): Promise<void> {
  const size = cache.size;
  cache.clear();
  await Log("backend", "warn", "cache", `Full cache CLEARED - removed ${size} entries`);
}

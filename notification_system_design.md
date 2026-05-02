# Notification System Design

---

## Stage 1

### Core Notification Actions (REST API Design)

The notification platform supports the following core actions for logged-in students:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Fetch all notifications for the current student |
| GET | `/api/notifications/type/:type` | Fetch notifications filtered by type (Event/Result/Placement) |
| GET | `/api/notifications/priority?n=10` | Fetch top N priority notifications |
| POST | `/api/notifications/:id/read` | Mark a notification as read |
| GET | `/api/notifications/unread/count` | Get unread notification count |
| POST | `/api/notifications/bulk-notify` | (Admin) Send notification to multiple students |

---

### JSON Request / Response Schemas

#### GET `/api/notifications`

**Request Headers:**
```json
{
  "Authorization": "Bearer <access_token>",
  "Content-Type": "application/json"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "notifications": [
    {
      "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "Type": "Result",
      "Message": "mid-sem",
      "Timestamp": "2026-04-22 17:51:30",
      "isRead": false
    }
  ]
}
```

#### POST `/api/notifications/:id/read`

**Request Headers:**
```json
{
  "Authorization": "Bearer <access_token>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "notificationID": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "isRead": true
}
```

#### GET `/api/notifications/unread/count`

**Response (200 OK):**
```json
{
  "success": true,
  "unreadCount": 12
}
```

---

### Real-Time Notification Mechanism

**Chosen approach: WebSockets**

When a new notification event is triggered (e.g., placement announcement), the server pushes it immediately to all connected clients without waiting for a request.

**Connection:**
```
ws://host:3012?studentID=<student_id>
```

**Server Push Event:**
```json
{
  "type": "new_notification",
  "data": {
    "ID": "b283218f-ea5a-4b7c-93a9-1f2f240d64b0",
    "Type": "Placement",
    "Message": "CSX Corporation hiring",
    "Timestamp": "2026-04-22 17:51:18"
  }
}
```

**Why WebSockets over SSE or Polling:**
- WebSockets are full-duplex and low-latency — ideal for real-time pushes to many concurrent students
- SSE is server-to-client only and works over HTTP/1.1 but lacks bidirectional capability
- Polling wastes resources by hitting the server on every interval even when there's nothing new

---

## Stage 2

### Recommended Database: PostgreSQL (Relational)

**Reasoning:**
- Notifications have a well-defined, consistent schema (ID, Type, Message, Timestamp, isRead, studentID)
- We need efficient queries by studentID, isRead status, Type, and createdAt
- PostgreSQL supports composite indexes, partial indexes, and JSONB for flexible metadata
- ACID compliance ensures notification delivery records are reliable

---

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE students (
  id           VARCHAR(36) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) UNIQUE NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        VARCHAR(36) NOT NULL REFERENCES students(id),
  notification_type notification_type NOT NULL,
  message           TEXT NOT NULL,
  is_read           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Index for the most common query pattern: unread notifications per student
CREATE INDEX idx_notifications_student_unread
  ON notifications (student_id, is_read, created_at DESC);

-- Index to support filtering by type
CREATE INDEX idx_notifications_type
  ON notifications (notification_type, created_at DESC);
```

---

### REST API to SQL Query Mapping

**GET all notifications for a student:**
```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT 50 OFFSET $2;
```

**GET unread notifications for a student:**
```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = $1
  AND is_read = FALSE
ORDER BY created_at DESC;
```

**GET notifications by type:**
```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
  AND notification_type = $2
ORDER BY created_at DESC;
```

---

### Scaling Challenges as Data Grows

As the platform grows to 50,000 students × 100+ notifications each = 5,000,000+ rows:

1. **Query performance degrades** — Full table scans without proper indexes become slow
2. **Write contention** — Bulk inserts during "Notify All" operations lock tables
3. **Storage** — Message text and timestamps accumulate rapidly
4. **Hot rows** — Popular notifications queried millions of times per hour

**Solutions:**
- Composite and partial indexes (covered in Stage 3)
- Read replicas for SELECT-heavy workloads
- Table partitioning by `created_at` (monthly partitions)
- Archiving old notifications to cold storage

---

## Stage 3

### Query Analysis

**Slow query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Why is it slow at scale (50,000 students, 5,000,000 notifications)?**

1. `SELECT *` fetches all columns including large `message` TEXT fields — unnecessary data transfer
2. Without a composite index on `(student_id, is_read, created_at)`, PostgreSQL performs a **sequential scan** across all 5M rows
3. Filtering on two columns (`studentID` AND `isRead`) without a covering index forces the DB to filter after fetching all student rows
4. `ORDER BY createdAt DESC` requires a sort operation unless the index already covers the sort order

---

### Is adding indexes on every column safe?

**No.** This advice is harmful for the following reasons:

- **Write overhead**: Every INSERT, UPDATE, or DELETE must update ALL indexes. With 50,000 students receiving notifications simultaneously ("Notify All"), write throughput collapses
- **Storage waste**: Each index consumes disk space comparable to the column data itself
- **Index bloat**: Low-cardinality columns (like `is_read` with only TRUE/FALSE) make terrible indexes — the DB often ignores them anyway
- **Query planner confusion**: Too many indexes cause the PostgreSQL planner to spend more time choosing between indexes

---

### Recommended Fix

Replace the slow query and add a targeted composite index:

```sql
-- Drop SELECT * and add a targeted composite index
CREATE INDEX idx_notifications_student_unread_date
  ON notifications (student_id, is_read, created_at DESC)
  WHERE is_read = FALSE;  -- Partial index: only indexes unread rows
```

**Optimized query:**
```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = FALSE
ORDER BY created_at DESC;
```

**What changed:**
- Replaced `SELECT *` with only needed columns — reduces I/O
- The partial index `WHERE is_read = FALSE` is smaller and faster (most reads query unread only)
- The composite index covers `student_id + is_read + created_at DESC` so PostgreSQL uses an **index scan** instead of a sequential scan + sort

**Estimated cost improvement:** From O(n) full scan → O(log n) index lookup

---

### Query: Students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
JOIN notifications n ON s.id = n.student_id
WHERE n.notification_type = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem

Notifications are fetched from DB on **every page load** for every student. With 50,000 students, this creates:
- Thousands of identical DB queries per second for the same data
- DB CPU spikes during peak hours (e.g., placement season, result announcements)
- High read latency causing poor user experience

---

### Suggested Solutions and Trade-offs

#### Option 1: In-Memory Cache (Implemented - current solution)

Store fetched notifications in an in-process Map with a TTL of 30 seconds.

| Trade-off | Detail |
|-----------|--------|
| ✅ Zero infrastructure | No Redis/Memcached needed |
| ✅ Microsecond read latency | Direct memory access |
| ❌ Data staleness up to TTL | Students may see notifications that are 30s old |
| ❌ No horizontal scaling | Each server instance has its own cache |
| ❌ Lost on restart | Cache is wiped when the process restarts |

**Best for:** Single-instance deployments or development

---

#### Option 2: Redis Cache (Recommended for production)

Replace the in-memory Map with a Redis instance shared across all server nodes.

| Trade-off | Detail |
|-----------|--------|
| ✅ Shared across instances | All nodes see the same cached data |
| ✅ Persistent across restarts | Optional Redis persistence (RDB/AOF) |
| ✅ Pub/Sub support | Can invalidate cache on new notifications |
| ❌ External dependency | Additional infrastructure to manage |
| ❌ Network hop | ~1-5ms latency vs microseconds for in-memory |

**Cache invalidation strategy:** When a new notification is created, publish an event to a Redis channel that all server instances subscribe to. On receiving the event, each instance deletes its local cache key and forces a fresh fetch on the next request.

---

#### Option 3: Pagination + Incremental Loading

Instead of loading all notifications at once, load the first 10 on page load and fetch more only when the user scrolls.

| Trade-off | Detail |
|-----------|--------|
| ✅ Minimal data transfer | Only loads what the user sees |
| ✅ Faster initial page load | DB query fetches 10 rows vs all |
| ❌ UX complexity | Requires frontend scroll/pagination logic |
| ❌ Cache harder to implement | Keyed by page/cursor instead of student |

---

#### Chosen approach for this implementation

In-memory cache (Option 1) with the following behaviour:
- Cache key: `all_notifications`
- TTL: 30 seconds
- On-demand invalidation via `POST /api/notifications/cache/invalidate`
- Cache is checked before every API fetch; on miss, data is fetched and re-cached

---

## Stage 5

### Analysis of the Naive `notify_all` Implementation

```
function notify_all(student_ids, message):
    for student_id in student_ids:
        send_email(student_id, message)   # calls Email API
        save_to_db(student_id, message)   # DB insert
        push_to_app(student_id, message)  # real-time push
```

**Shortcomings:**

1. **Sequential processing** — 50,000 students processed one-by-one. At 10ms per iteration, this takes ~8 minutes
2. **Tight coupling** — All three operations (email, DB, push) are in the same synchronous loop. A failure in one blocks the others
3. **No atomicity** — If `send_email` fails at student #200, students 1-199 have emails but no DB record. Data is now inconsistent
4. **No retry** — A transient email API failure permanently skips that student with no recovery
5. **Email API failure at #200** — Students 201-50000 never get notified. The loop simply crashes/stops

---

### Should saving to DB and sending email happen together?

**No.** They should be decoupled for these reasons:

- DB save is the **source of truth** and must succeed first — if it fails, nothing should proceed
- Email delivery is **eventually consistent** — it's acceptable for an email to arrive 1 second later than the DB record
- Coupling them in the same transaction means a temporary email API outage rolls back DB records that should be saved regardless

---

### Redesigned `notify_all` with Revised Pseudocode

```
function notify_all(student_ids, message):
    // Step 1: Batch insert ALL students into DB in a single transaction
    // This is atomic - either all succeed or none do
    try:
        batch_save_to_db(student_ids, message)   # Single SQL INSERT with all IDs
    catch dbError:
        log("fatal", "db", "Batch DB insert failed - aborting notify_all")
        throw dbError  # Do NOT proceed if DB save failed

    // Step 2: Push real-time notification to all connected WebSocket clients
    // This is fast and non-blocking
    broadcast_to_websocket(message)

    // Step 3: Enqueue email jobs in a message queue (e.g., BullMQ / SQS)
    // Email workers pick up jobs asynchronously with retry logic
    for student_id in student_ids:
        emailQueue.enqueue({
            studentID: student_id,
            message: message,
            retries: 3,
            backoff: "exponential"
        })

    // Return immediately - email delivery happens in background
    return { queued: len(student_ids), dbSaved: true }
```

**What happens if email fails for student #200:**
- The job remains in the queue with `status=failed`
- A worker retries up to 3 times with exponential backoff
- After max retries, the job moves to a Dead Letter Queue (DLQ) for manual inspection
- DB records are **not affected** — they were saved before email was attempted
- All other students continue to receive emails uninterrupted

---

## Stage 6

### Priority Inbox Design

**Requirement:** Display top N unread notifications prioritized by type and recency.

**Priority Rule:** `Placement > Result > Event`, with recency as tiebreaker within the same type.

---

### Implementation Approach

**Priority Score Formula:**
```
priorityScore = typeWeight × 10^13 + timestampMs
```

Where type weights are:
- Placement = 3
- Result = 2
- Event = 1

The `10^13` multiplier ensures type always dominates over timestamp differences (timestamps are ~13 digits in milliseconds since epoch). Two notifications of different types will always be ordered by type regardless of their timestamps.

**Algorithm:**
1. Fetch all notifications from cache/API
2. Compute `priorityScore` for each
3. Sort descending by `priorityScore` — O(n log n)
4. Return top N via `.slice(0, n)`

---

### Handling Continuously Incoming Notifications

As new notifications stream in, we need to efficiently maintain the top N list without re-sorting all notifications from scratch on every new arrival.

**Efficient approach: Min-Heap of size N**

- Maintain a min-heap of size N where the root is the lowest-priority item in the current top N
- For each new notification:
  - Compute its `priorityScore`
  - If `score > heap.min`: evict the min, insert the new notification — O(log N)
  - Otherwise: discard the new notification — O(1)
- Result: O(n log N) time to process n notifications vs O(n log n) for full re-sort

For this implementation, we use sort + slice since the dataset is fetched in batch. In a streaming context (WebSocket feed), a min-heap would be used.

---

### API

```
GET /api/notifications/priority?n=10
```

**Response:**
```json
{
  "success": true,
  "requestedTop": 10,
  "returnedCount": 10,
  "priorityOrder": "Placement > Result > Event, then by recency",
  "notifications": [
    {
      "ID": "b283218f-...",
      "Type": "Placement",
      "Message": "CSX Corporation hiring",
      "Timestamp": "2026-04-22 17:51:18",
      "priorityScore": 39000001745342278
    }
  ]
}
```

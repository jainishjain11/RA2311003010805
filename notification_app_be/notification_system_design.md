# Campus Notification Platform — System Design

---

## Stage 1 — REST API Design

### Overview

All endpoints are protected. Clients must pass `Authorization: Bearer <token>` on every request.

---

### 1.1 — Get All Notifications (Paginated)

```
GET /api/notifications?page=1&limit=20
```

**Request Headers**
```
Authorization: Bearer <token>
```

**Query Parameters**

| Param   | Type    | Default | Description              |
|---------|---------|---------|--------------------------|
| `page`  | integer | 1       | Page number (1-indexed)  |
| `limit` | integer | 20      | Items per page (max 100) |

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "Placement",
        "message": "You have been shortlisted for TCS.",
        "timestamp": "2024-01-15T10:30:00Z",
        "isRead": false,
        "readAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Status Codes**

| Code | Meaning                   |
|------|---------------------------|
| 200  | Success                   |
| 400  | Invalid pagination params |
| 401  | Missing / invalid token   |
| 500  | Internal server error     |

---

### 1.2 — Get Single Notification by ID

```
GET /api/notifications/:id
```

**Request Headers**
```
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "Result",
    "message": "Your semester 5 results have been published.",
    "timestamp": "2024-01-14T08:00:00Z",
    "isRead": true,
    "readAt": "2024-01-14T09:15:00Z"
  }
}
```

**Status Codes**

| Code | Meaning                |
|------|------------------------|
| 200  | Success                |
| 401  | Unauthorized           |
| 404  | Notification not found |
| 500  | Internal server error  |

---

### 1.3 — Mark a Single Notification as Read

```
PATCH /api/notifications/:id/read
```

**Request Headers**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body** — none required (action is implied by route)

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "isRead": true,
    "readAt": "2024-01-15T11:00:00Z"
  }
}
```

**Status Codes**

| Code | Meaning                                  |
|------|------------------------------------------|
| 200  | Notification marked read                 |
| 401  | Unauthorized                             |
| 404  | Notification not found for this student  |
| 500  | Internal server error                    |

---

### 1.4 — Mark All Notifications as Read

```
PATCH /api/notifications/read-all
```

**Request Headers**
```
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "updatedCount": 42,
    "readAt": "2024-01-15T11:05:00Z"
  }
}
```

**Status Codes**

| Code | Meaning                |
|------|------------------------|
| 200  | All notifications read |
| 401  | Unauthorized           |
| 500  | Internal server error  |

---

### 1.5 — Get Unread Count

```
GET /api/notifications/unread-count
```

**Request Headers**
```
Authorization: Bearer <token>
```

**Response — 200 OK**
```json
{
  "success": true,
  "data": {
    "unreadCount": 7
  }
}
```

**Status Codes**

| Code | Meaning               |
|------|-----------------------|
| 200  | Success               |
| 401  | Unauthorized          |
| 500  | Internal server error |

---

### 1.6 — Real-Time Notification Mechanism

**Choice: Server-Sent Events (SSE)**

**Justification over WebSockets:**

| Criterion         | SSE                              | WebSockets                          |
|-------------------|----------------------------------|-------------------------------------|
| Communication     | Server to Client (unidirectional)| Bidirectional                       |
| Protocol overhead | Minimal (HTTP/1.1)               | Handshake + framing overhead        |
| Auto-reconnect    | Built into browser spec          | Must be implemented manually        |
| Firewall/proxy    | Works through all HTTP proxies   | May be blocked by corporate proxies |
| Use case fit      | Perfect — only server pushes     | Overkill for notifications          |
| Infrastructure    | No extra server needed           | Needs WS-capable server             |

For a campus notification system, data only flows **server to client**. SSE is the correct, simpler choice.

**SSE Endpoint:**
```
GET /api/notifications/stream
Authorization: Bearer <token>  (passed as query param for EventSource compatibility)
```

**Server Implementation (conceptual):**
```js
app.get('/api/notifications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Subscribe this client to notifications for their studentId
  const unsubscribe = notificationBus.subscribe(req.user.studentId, (notification) => {
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
```

**Client Usage:**
```js
const source = new EventSource('/api/notifications/stream?token=<bearer>');
source.onmessage = (e) => {
  const notification = JSON.parse(e.data);
  updateNotificationBadge(notification);
};
```

---

## Stage 2 — Database Design

### Why PostgreSQL?

| Requirement             | PostgreSQL Advantage                                           |
|-------------------------|----------------------------------------------------------------|
| ACID compliance         | Full transactional guarantees — no partial writes              |
| Relational data         | `student_notifications` is a classic many-to-many join table   |
| Enum types              | Native ENUM prevents invalid `type` values at DB level         |
| JSON support            | `JSONB` columns available if payload metadata is needed        |
| Indexing                | Composite indexes + partial indexes for unread filtering       |
| Partitioning            | Range/List partitioning for high-volume notification tables    |
| Open source + community | Production-proven at scale (Notion, Instagram, GitLab)         |

---

### Schema

```sql
-- Notification type enum
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

-- Students table
CREATE TABLE students (
  student_id SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE
);

-- Notifications master table
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       notification_type NOT NULL,
  message    TEXT              NOT NULL,
  created_at TIMESTAMP         NOT NULL DEFAULT NOW()
);

-- Junction table — tracks per-student read state
CREATE TABLE student_notifications (
  student_id      INT  NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id)    ON DELETE CASCADE,
  is_read         BOOLEAN   NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMP,
  PRIMARY KEY (student_id, notification_id)
);
```

---

### Scale Considerations (50k students, 5M notifications)

At this volume the naive schema breaks down in two ways:

1. **Sequential scans** — `WHERE student_id = X AND is_read = false` with no index does a full table scan.
2. **Expensive JOINs** — joining `student_notifications` (potentially 250M rows at full fanout) against `notifications` becomes the bottleneck.

**Solutions:**

```sql
-- Composite index on the hot query path
CREATE INDEX idx_sn_student_unread_time
  ON student_notifications (student_id, is_read, read_at DESC);

-- Partial index — only unread rows; smaller, fits in memory
CREATE INDEX idx_sn_unread_only
  ON student_notifications (student_id)
  WHERE is_read = FALSE;

-- Index on notification timestamp for recent-N queries
CREATE INDEX idx_notif_created ON notifications (created_at DESC);

-- Index on notification type for filtered queries
CREATE INDEX idx_notif_type ON notifications (type);
```

---

### SQL for Each REST Endpoint

**1.1 — Get paginated notifications for a student**
```sql
SELECT
  n.id,
  n.type,
  n.message,
  n.created_at  AS timestamp,
  sn.is_read,
  sn.read_at
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE sn.student_id = $1
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;
-- $1=studentId, $2=limit, $3=(page-1)*limit
```

**1.2 — Get single notification**
```sql
SELECT
  n.id, n.type, n.message, n.created_at AS timestamp,
  sn.is_read, sn.read_at
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE sn.student_id = $1
  AND sn.notification_id = $2;
```

**1.3 — Mark single notification as read**
```sql
UPDATE student_notifications
SET    is_read = TRUE, read_at = NOW()
WHERE  student_id = $1 AND notification_id = $2 AND is_read = FALSE
RETURNING notification_id, is_read, read_at;
```

**1.4 — Mark all notifications as read**
```sql
UPDATE student_notifications
SET    is_read = TRUE, read_at = NOW()
WHERE  student_id = $1 AND is_read = FALSE;
```

**1.5 — Get unread count**
```sql
SELECT COUNT(*) AS unread_count
FROM   student_notifications
WHERE  student_id = $1 AND is_read = FALSE;
```

---

## Stage 3 — Query Optimization

### The Slow Query

```sql
-- ORIGINAL (problematic)
SELECT * FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC;
```

**Problems Identified:**

| Problem | Impact |
|---------|--------|
| `SELECT *` fetches all columns including unused ones | Extra I/O, cannot use covering index |
| No index on `(studentID, isRead, createdAt)` | Forces full table scan |
| Over-indexing every column (as suggested by other dev) | Each extra index adds write overhead on INSERT/UPDATE — slows bulk delivery |

---

### Fix

**Targeted index — add exactly this, nothing more:**
```sql
CREATE INDEX idx_student_unread
  ON student_notifications (student_id, is_read, read_at DESC);
```

This composite index lets PostgreSQL filter by `student_id` and `is_read` and return rows pre-sorted — **no separate sort step needed**.

**Optimized query:**
```sql
SELECT
  n.id,
  n.type,
  n.message,
  n.created_at
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
WHERE sn.student_id = 1042
  AND sn.is_read    = false
ORDER BY n.created_at DESC;
```

---

### Students with Placement Notifications in Last 7 Days

```sql
SELECT DISTINCT
  s.student_id,
  s.name
FROM student_notifications sn
JOIN notifications n ON sn.notification_id = n.id
JOIN students      s ON sn.student_id      = s.student_id
WHERE n.type       = 'Placement'
  AND n.created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4 — Caching Strategy

### Problem

Without caching, every page load for every student hits the database. With 50k active students this creates 50,000 queries per load cycle, redundant reads for unchanged data, and connection pool exhaustion.

### Solution: Redis Cache with TTL

**Key design:**
```
notifications:{studentId}:{page}:{limit}   TTL 60s
notifications:{studentId}:unread           TTL 30s
```

**Cache Flow:**
```
Client Request
     |
     v
Redis.get(cacheKey)
     |
     +-- HIT  ──────────────────────────► Return cached JSON  (no DB hit)
     |
     +-- MISS
           |
           v
        Query PostgreSQL
           |
           v
        Redis.set(cacheKey, result, EX 60)
           |
           v
        Return result to client
```

**Cache Invalidation on new notification:**
```js
await redis.del(`notifications:${studentId}`);
await redis.del(`notifications:${studentId}:unread`);
```

**Trade-offs:**

| Consideration    | Impact                                                        |
|------------------|---------------------------------------------------------------|
| Staleness        | Up to 60s old — acceptable for campus notifications           |
| Memory           | ~2KB per entry x 50k = ~100MB max — fits comfortably in Redis |
| Invalidation     | Event-driven delete on new notification keeps data fresh      |
| DB load reduction| 95%+ on steady state with high cache hit ratio                |

---

## Stage 5 — Bulk Notification Fix

### Original Pseudocode (Broken)

```python
def notify_all(student_ids, message):
    for student_id in student_ids:
        send_email(student_id, message)   # Fails at student 200 → rest never notified
        save_to_db(student_id, message)   # Sequential — very slow for 50k students
        push_to_app(student_id, message)  # No retry on failure
```

**Problems:**
1. One failure stops the entire loop — students after the failure point receive nothing.
2. Sequential processing of 50k students could take hours.
3. No retry mechanism — transient failures become permanent.
4. Email and DB save are tightly coupled — a flaky SMTP server blocks DB writes.

---

### Fix: Message Queue (BullMQ / RabbitMQ)

**Revised Pseudocode:**
```js
// Producer — returns immediately
async function notify_all(student_ids, message) {
  for (const student_id of student_ids) {
    await queue.add('notify', { student_id, message }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

// Worker — runs concurrently across N processes
queue.process('notify', NUM_WORKERS, async (job) => {
  const { student_id, message } = job.data;

  await save_to_db(student_id, message);  // Always first — source of truth

  // Email and push are best-effort
  await send_email(student_id, message).catch(err =>
    Log("backend", "warn", "service", `Email failed: ${err.message}`)
  );
  await push_to_app(student_id, message).catch(err =>
    Log("backend", "warn", "service", `Push failed: ${err.message}`)
  );
});
```

**Should DB save and email happen together?**

No. They must be independent:
- `save_to_db` is the source of truth and must always succeed first.
- `send_email` and `push_to_app` are best-effort delivery channels.
- A flaky SMTP server should never prevent a notification from being persisted.

---

## Stage 6 — Priority Inbox

### Priority Score Formula

```
score = typeWeight * recencyScore
typeWeight   : Placement = 3 | Result = 2 | Event = 1
recencyScore : 1 / (1 + hoursSinceNotification)
```

A Placement from 1 hour ago: `3 * (1 / 2) = 1.5`
An Event from 0 hours ago:   `1 * (1 / 1) = 1.0`

This correctly surfaces urgent placement notices over stale event reminders.

### Data Structure: Min-Heap of size N

**Why a Min-Heap?**

| Approach           | Time       | Space  |
|--------------------|------------|--------|
| Sort all then slice| O(n log n) | O(n)   |
| Min-Heap of size N | O(n log N) | O(N)   |

When N is small (e.g. 10) and n is large (e.g. 10,000), the heap approach is dramatically more efficient.

**Heap mechanics:**
- Heap root always holds the **lowest** score in the current top-N set.
- For each new notification: if score > root → pop root, push new item.
- This evicts the weakest candidate and admits the stronger one.

**Implementation:** See `services/priorityService.js`

### Endpoint

```
GET /notifications/priority?n=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topN": 10,
    "notifications": [
      {
        "ID": "abc-123",
        "Type": "Placement",
        "Message": "Interview scheduled with Google on Jan 20",
        "Timestamp": "2024-01-19T14:00:00Z",
        "priorityScore": 2.823529
      }
    ]
  }
}
```

Results are sorted by `priorityScore` descending — highest urgency first.

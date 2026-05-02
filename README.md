# Affordmed Campus Hiring Evaluation - Backend

## Repository Structure

```
.
├── logging_middleware/           # Pre-Test: Reusable logging package
├── vehicle_maintence_scheduler/  # Backend Task 1: Vehicle Maintenance Scheduler
├── notification_app_be/          # Backend Task 2: Campus Notifications Microservice
└── notification_system_design.md # System design doc (Stages 1-6)
```

---

## Setup Instructions

### Step 1: Register and get your credentials

```bash
curl -X POST http://20.207.122.201/evaluation-service/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@college.edu",
    "name": "Your Name",
    "mobileNo": "9999999999",
    "githubUsername": "your-github",
    "rollNo": "your-roll-no",
    "accessCode": "your-access-code"
  }'
```

Save the `clientID` and `clientSecret` from the response.

### Step 2: Get your access token

```bash
curl -X POST http://20.207.122.201/evaluation-service/auth \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@college.edu",
    "name": "Your Name",
    "rollNo": "your-roll-no",
    "accessCode": "your-access-code",
    "clientID": "your-client-id",
    "clientSecret": "your-client-secret"
  }'
```

Save the `access_token`.

---

## Running Each Service

### Logging Middleware
```bash
cd logging_middleware
npm install
```

### Vehicle Maintenance Scheduler
```bash
cd vehicle_maintence_scheduler
cp .env.example .env
# Edit .env and set ACCESS_TOKEN=your_access_token
npm install
npm run dev
# Server runs on http://localhost:3001
```

**Endpoints:**
- `GET /api/schedule` — Optimal schedules for all depots
- `GET /api/schedule/:depotID` — Schedule for a specific depot
- `GET /health` — Health check

### Notification App BE
```bash
cd notification_app_be
cp .env.example .env
# Edit .env and set ACCESS_TOKEN=your_access_token
npm install
npm run dev
# HTTP server: http://localhost:3002
# WebSocket: ws://localhost:3012?studentID=<your_id>
```

**Endpoints:**
- `GET /api/notifications` — All notifications (cached)
- `GET /api/notifications/priority?n=10` — Top N by priority
- `GET /api/notifications/type/:type` — Filter by type
- `POST /api/notifications/bulk-notify` — Bulk notify students
- `POST /api/notifications/cache/invalidate` — Invalidate cache
- `GET /api/notifications/ws/status` — WebSocket stats

---

## Key Design Decisions

### Logging Middleware
- Reusable `Log(stack, level, package, message)` function
- All services import and use this — no `console.log` in production code

### Vehicle Maintenance Scheduler
- Uses **0/1 Knapsack DP** algorithm (O(n×W)) to maximize impact score within mechanic-hour budget
- Fetches depot and vehicle data from Affordmed APIs on each request

### Campus Notifications (6 Stages)
- **Stage 1**: REST API design + WebSocket real-time push
- **Stage 2**: PostgreSQL schema with composite indexes
- **Stage 3**: Query optimization with partial indexes
- **Stage 4**: In-memory cache (30s TTL) to prevent DB overload
- **Stage 5**: Redesigned bulk notify with batch DB insert + async email queue
- **Stage 6**: Priority inbox using `typeWeight × 10^13 + timestampMs` scoring

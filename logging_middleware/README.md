# Affordmed Logging Middleware

A reusable logging package that sends structured log entries to the Affordmed Test Server.

## Setup

```bash
npm install
npm run build
```

## Usage

### 1. Initialize the logger (once at app startup)

```typescript
import { initLogger, Log } from "./logging_middleware";

initLogger("YOUR_ACCESS_TOKEN_HERE");
```

### 2. Use `Log()` throughout your codebase

```typescript
Log(stack, level, package, message)
```

### Parameters

| Param     | Type     | Allowed Values |
|-----------|----------|----------------|
| `stack`   | string   | `"backend"` \| `"frontend"` |
| `level`   | string   | `"debug"` \| `"info"` \| `"warn"` \| `"error"` \| `"fatal"` |
| `package` | string   | See table below |
| `message` | string   | Any descriptive string |

### Package Values

**Backend only:** `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`

**Frontend only:** `api`, `component`, `hook`, `page`, `state`, `style`

**Both:** `auth`, `config`, `middleware`, `utils`

### Examples

```typescript
// Successful operation
Log("backend", "info", "service", "VehicleService: Successfully fetched 25 vehicles from depot 3");

// Warning
Log("backend", "warn", "controller", "SchedulerController: No vehicles found for depotID=99");

// Error
Log("backend", "error", "db", "Database query failed: connection timeout after 30s");

// Fatal
Log("backend", "fatal", "db", "Critical database connection failure - all retries exhausted");

// Debug
Log("backend", "debug", "service", "KnapsackSolver: Processing 50 vehicles with budget=188 hours");
```

import app from "./app";
import { config } from "./config";
import { Log } from "./utils/logger";
import { createWebSocketServer } from "./middleware/websocketManager";

const PORT = Number(config.port);
const WS_PORT = PORT + 10; // e.g., 3012 for WebSocket

// Start HTTP server
app.listen(PORT, async () => {
  await Log("backend", "info", "config", `NotificationService: HTTP server started on port ${PORT}`);
  console.log(`[Server] Notification App BE running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  GET  /api/notifications                  - All notifications`);
  console.log(`  GET  /api/notifications/priority?n=10    - Top N priority notifications`);
  console.log(`  GET  /api/notifications/type/:type       - Filter by type`);
  console.log(`  GET  /api/notifications/ws/status        - WebSocket stats`);
  console.log(`  POST /api/notifications/bulk-notify      - Bulk notify students`);
  console.log(`  POST /api/notifications/cache/invalidate - Invalidate cache`);
  console.log(`  GET  /health                             - Health check`);
});

// Start WebSocket server for real-time notifications (Stage 1)
const wss = createWebSocketServer(WS_PORT);
wss.on("listening", async () => {
  await Log("backend", "info", "config", `NotificationService: WebSocket server started on port ${WS_PORT}`);
  console.log(`[WebSocket] Real-time server on ws://localhost:${WS_PORT}`);
  console.log(`[WebSocket] Connect: ws://localhost:${WS_PORT}?studentID=<your_id>`);
});

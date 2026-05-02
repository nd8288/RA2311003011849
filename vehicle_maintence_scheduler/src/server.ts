import app from "./app";
import { config } from "./config";
import { Log } from "./utils/logger";

const PORT = config.port;

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `VehicleMaintenanceScheduler: Server started on port ${PORT}`);
  console.log(`[Server] Vehicle Maintenance Scheduler running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  GET /api/schedule          - All depot schedules`);
  console.log(`  GET /api/schedule/:depotID - Single depot schedule`);
  console.log(`  GET /health                - Health check`);
});

import { Router } from "express";
import { getAllSchedules, getScheduleByDepot } from "../handler/schedulerHandler";

const router = Router();

/**
 * GET /api/schedule
 * Returns optimal maintenance schedules for ALL depots.
 * Response: { success, totalDepots, schedules: [{ depotID, mechanicHoursBudget, totalImpactScore, totalHoursUsed, selectedTasks }] }
 */
router.get("/", getAllSchedules);

/**
 * GET /api/schedule/:depotID
 * Returns optimal maintenance schedule for a SPECIFIC depot.
 * Response: { success, depotID, mechanicHoursBudget, totalImpactScore, totalHoursUsed, selectedTasks }
 */
router.get("/:depotID", getScheduleByDepot);

export default router;

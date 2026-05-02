import { Request, Response } from "express";
import { Log } from "../utils/logger";
import { fetchDepots, fetchVehicles } from "../repository/vehicleRepository";
import { buildScheduleResults, solveSchedule } from "../service/schedulerService";

/**
 * GET /api/schedule
 * Returns optimal maintenance schedules for all depots.
 */
export async function getAllSchedules(req: Request, res: Response): Promise<void> {
  await Log("backend", "info", "handler", "getAllSchedules: Request received for all depot schedules");

  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

    await Log("backend", "debug", "handler", `getAllSchedules: Fetched ${depots.length} depots and ${vehicles.length} vehicles`);

    const results = await buildScheduleResults(vehicles, depots);

    await Log("backend", "info", "handler", `getAllSchedules: Successfully computed schedules for ${results.length} depots`);

    res.status(200).json({
      success: true,
      totalDepots: results.length,
      schedules: results,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `getAllSchedules: Failed to compute schedules - ${String(err)}`);
    res.status(500).json({ success: false, error: "Failed to compute maintenance schedules" });
  }
}

/**
 * GET /api/schedule/:depotID
 * Returns optimal maintenance schedule for a specific depot.
 */
export async function getScheduleByDepot(req: Request, res: Response): Promise<void> {
  const depotID = parseInt(req.params.depotID, 10);

  await Log("backend", "info", "handler", `getScheduleByDepot: Request received for depot ID=${depotID}`);

  if (isNaN(depotID)) {
    await Log("backend", "warn", "handler", `getScheduleByDepot: Invalid depotID received - "${req.params.depotID}"`);
    res.status(400).json({ success: false, error: "depotID must be a valid integer" });
    return;
  }

  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

    const depot = depots.find((d) => d.ID === depotID);
    if (!depot) {
      await Log("backend", "warn", "handler", `getScheduleByDepot: Depot ID=${depotID} not found in fetched depots`);
      res.status(404).json({ success: false, error: `Depot with ID=${depotID} not found` });
      return;
    }

    await Log("backend", "debug", "handler", `getScheduleByDepot: Found depot ID=${depotID} with ${depot.MechanicHours} hours budget`);

    const { selectedTasks, totalImpact, totalHours } = await solveSchedule(
      vehicles,
      depot.MechanicHours,
      depot.ID
    );

    await Log("backend", "info", "handler", `getScheduleByDepot: Schedule computed for depot=${depotID}, impact=${totalImpact}, hours=${totalHours}`);

    res.status(200).json({
      success: true,
      depotID: depot.ID,
      mechanicHoursBudget: depot.MechanicHours,
      totalImpactScore: totalImpact,
      totalHoursUsed: totalHours,
      selectedTasks,
    });
  } catch (err) {
    await Log("backend", "error", "handler", `getScheduleByDepot: Error processing depot ID=${depotID} - ${String(err)}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

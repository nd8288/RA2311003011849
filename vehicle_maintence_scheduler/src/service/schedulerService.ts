import { Log } from "../utils/logger";
import { Vehicle, ScheduleResult } from "../domain/types";

/**
 * Solves the 0/1 Knapsack problem to select the optimal set of vehicle tasks.
 *
 * Problem: Given a list of vehicles with Duration (weight) and Impact (value),
 * and a depot's MechanicHours (capacity), select tasks to maximise total Impact
 * without exceeding the available MechanicHours.
 *
 * Algorithm: Dynamic Programming - O(n * W) time, O(n * W) space
 * This handles real-world scale inputs efficiently.
 *
 * @param vehicles       - Array of vehicle tasks with Duration and Impact
 * @param mechanicHours  - Total mechanic-hours available for the depot
 * @param depotID        - Depot ID (used only for logging context)
 * @returns              - Selected tasks and total impact score
 */
export async function solveSchedule(
  vehicles: Vehicle[],
  mechanicHours: number,
  depotID: number
): Promise<{ selectedTasks: Vehicle[]; totalImpact: number; totalHours: number }> {
  const n = vehicles.length;
  const W = mechanicHours;

  await Log(
    "backend",
    "info",
    "service",
    `KnapsackSolver: Starting schedule for depot=${depotID}, vehicles=${n}, budget=${W} hours`
  );

  if (n === 0 || W <= 0) {
    await Log("backend", "warn", "service", `KnapsackSolver: Empty input for depot=${depotID}. Returning empty schedule.`);
    return { selectedTasks: [], totalImpact: 0, totalHours: 0 };
  }

  // Build DP table
  // dp[i][w] = max impact using first i items with capacity w
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

  await Log("backend", "debug", "service", `KnapsackSolver: Building DP table of size ${n + 1} x ${W + 1} for depot=${depotID}`);

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= W; w++) {
      // Option 1: Don't include vehicle i
      dp[i][w] = dp[i - 1][w];
      // Option 2: Include vehicle i (if it fits)
      if (Duration <= w) {
        const withItem = dp[i - 1][w - Duration] + Impact;
        if (withItem > dp[i][w]) {
          dp[i][w] = withItem;
        }
      }
    }
  }

  const maxImpact = dp[n][W];
  await Log("backend", "info", "service", `KnapsackSolver: Optimal impact score = ${maxImpact} for depot=${depotID}`);

  // Backtrack to find selected items
  const selectedTasks: Vehicle[] = [];
  let w = W;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selectedTasks.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  const totalHours = selectedTasks.reduce((sum, v) => sum + v.Duration, 0);

  await Log(
    "backend",
    "info",
    "service",
    `KnapsackSolver: Selected ${selectedTasks.length} tasks using ${totalHours}/${W} hours for depot=${depotID}`
  );

  return { selectedTasks, totalImpact: maxImpact, totalHours };
}

/**
 * Orchestrates fetching data and computing schedules for all depots.
 */
export async function buildScheduleResults(
  vehicles: Vehicle[],
  depots: { ID: number; MechanicHours: number }[]
): Promise<ScheduleResult[]> {
  await Log("backend", "info", "service", `SchedulerService: Building schedules for ${depots.length} depots with ${vehicles.length} total vehicles`);

  const results: ScheduleResult[] = [];

  for (const depot of depots) {
    await Log("backend", "debug", "service", `SchedulerService: Processing depot ID=${depot.ID}, budget=${depot.MechanicHours} hours`);

    const { selectedTasks, totalImpact, totalHours } = await solveSchedule(
      vehicles,
      depot.MechanicHours,
      depot.ID
    );

    results.push({
      depotID: depot.ID,
      mechanicHoursBudget: depot.MechanicHours,
      totalImpactScore: totalImpact,
      totalHoursUsed: totalHours,
      selectedTasks,
    });
  }

  await Log("backend", "info", "service", `SchedulerService: Completed scheduling for all ${depots.length} depots`);
  return results;
}

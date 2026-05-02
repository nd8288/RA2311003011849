import { config } from "../config";
import { Log } from "../utils/logger";
import { DepotAPIResponse, VehicleAPIResponse, Depot, Vehicle } from "../domain/types";

/**
 * Fetches all depots from the Affordmed evaluation service.
 */
export async function fetchDepots(): Promise<Depot[]> {
  await Log("backend", "info", "repository", "fetchDepots: Initiating GET /evaluation-service/depots");

  try {
    const response = await fetch(`${config.baseURL}/evaluation-service/depots`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      await Log("backend", "error", "repository", `fetchDepots: API returned HTTP ${response.status} - ${errBody}`);
      throw new Error(`Depot API error: ${response.status}`);
    }

    const data = await response.json() as DepotAPIResponse;
    await Log("backend", "info", "repository", `fetchDepots: Successfully fetched ${data.depots.length} depots`);
    return data.depots;
  } catch (err) {
    await Log("backend", "fatal", "repository", `fetchDepots: Critical failure fetching depots - ${String(err)}`);
    throw err;
  }
}

/**
 * Fetches all vehicles/tasks from the Affordmed evaluation service.
 */
export async function fetchVehicles(): Promise<Vehicle[]> {
  await Log("backend", "info", "repository", "fetchVehicles: Initiating GET /evaluation-service/vehicles");

  try {
    const response = await fetch(`${config.baseURL}/evaluation-service/vehicles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      await Log("backend", "error", "repository", `fetchVehicles: API returned HTTP ${response.status} - ${errBody}`);
      throw new Error(`Vehicles API error: ${response.status}`);
    }

    const data = await response.json() as VehicleAPIResponse;
    await Log("backend", "info", "repository", `fetchVehicles: Successfully fetched ${data.vehicles.length} vehicles`);
    return data.vehicles;
  } catch (err) {
    await Log("backend", "fatal", "repository", `fetchVehicles: Critical failure fetching vehicles - ${String(err)}`);
    throw err;
  }
}

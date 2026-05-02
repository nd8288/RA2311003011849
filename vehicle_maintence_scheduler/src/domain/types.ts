/**
 * Domain types for the Vehicle Maintenance Scheduler
 */

export interface Depot {
  ID: number;
  MechanicHours: number;
}

export interface Vehicle {
  TaskID: string;
  Duration: number;
  Impact: number;
}

export interface ScheduleResult {
  depotID: number;
  mechanicHoursBudget: number;
  totalImpactScore: number;
  totalHoursUsed: number;
  selectedTasks: Vehicle[];
}

export interface DepotAPIResponse {
  depots: Depot[];
}

export interface VehicleAPIResponse {
  vehicles: Vehicle[];
}

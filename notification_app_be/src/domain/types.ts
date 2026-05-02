/**
 * Domain types for the Campus Notifications Microservice
 */

export type NotificationType = "Event" | "Result" | "Placement";

export interface Notification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

export interface PrioritizedNotification extends Notification {
  priorityScore: number;
}

export interface NotificationAPIResponse {
  notifications: Notification[];
}

// Weight map for priority scoring (Stage 6)
// Placement > Result > Event
export const TYPE_WEIGHT: Record<NotificationType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

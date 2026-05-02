import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Log } from "../utils/logger";
import { Notification } from "../domain/types";

interface ConnectedClient {
  ws: WebSocket;
  studentID?: string;
  connectedAt: Date;
}

const clients = new Map<string, ConnectedClient>();

/**
 * Initializes the WebSocket server for real-time notifications.
 * Stage 1: Real-time notification mechanism using WebSockets.
 *
 * Connection flow:
 * 1. Client connects: ws://host/ws?studentID=123
 * 2. Server registers client with studentID
 * 3. New notifications are pushed to all connected clients
 * 4. Client disconnects -> server cleans up
 */
export function createWebSocketServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const studentID = url.searchParams.get("studentID") || `anon_${Date.now()}`;

    const clientID = studentID;
    clients.set(clientID, { ws, studentID, connectedAt: new Date() });

    await Log("backend", "info", "middleware", `WebSocket: New connection - studentID=${studentID}, total clients=${clients.size}`);

    ws.send(JSON.stringify({ type: "connected", message: `Connected as studentID=${studentID}` }));

    ws.on("message", async (data) => {
      await Log("backend", "debug", "middleware", `WebSocket: Message from studentID=${studentID}: ${data.toString()}`);
    });

    ws.on("close", async () => {
      clients.delete(clientID);
      await Log("backend", "info", "middleware", `WebSocket: Disconnected - studentID=${studentID}, remaining clients=${clients.size}`);
    });

    ws.on("error", async (err) => {
      await Log("backend", "error", "middleware", `WebSocket: Error for studentID=${studentID} - ${err.message}`);
      clients.delete(clientID);
    });
  });

  return wss;
}

/**
 * Broadcasts a new notification to all connected WebSocket clients.
 */
export async function broadcastNotification(notification: Notification): Promise<void> {
  const payload = JSON.stringify({ type: "new_notification", data: notification });
  let sentCount = 0;

  for (const [clientID, client] of clients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
      sentCount++;
    } else {
      clients.delete(clientID);
    }
  }

  await Log("backend", "info", "middleware", `WebSocket: Broadcast sent to ${sentCount} connected clients`);
}

/**
 * Sends a notification to a specific student by studentID.
 */
export async function pushToStudent(studentID: string, notification: Notification): Promise<void> {
  const client = clients.get(studentID);

  if (!client || client.ws.readyState !== WebSocket.OPEN) {
    await Log("backend", "warn", "middleware", `WebSocket: Student ${studentID} not connected, skipping push`);
    return;
  }

  client.ws.send(JSON.stringify({ type: "new_notification", data: notification }));
  await Log("backend", "debug", "middleware", `WebSocket: Pushed notification to studentID=${studentID}`);
}

export function getConnectedClientCount(): number {
  return clients.size;
}

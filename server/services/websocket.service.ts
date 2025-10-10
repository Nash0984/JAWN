import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage, Server } from "http";
import { parse } from "url";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/notifications"
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    this.startHeartbeat();

    console.log("WebSocket server initialized on /ws/notifications");
  }

  private handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
    const { query } = parse(req.url || "", true);
    const userId = query.userId as string;

    if (!userId) {
      console.error("WebSocket connection rejected: missing userId");
      ws.close(1008, "User ID required");
      return;
    }

    // Store connection
    ws.userId = userId;
    ws.isAlive = true;

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);

    console.log(`WebSocket client connected: ${userId}`);

    // Set up ping/pong for connection health
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(ws, data);
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    });

    ws.on("close", () => {
      this.handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.handleDisconnect(ws);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: "connection_established",
      message: "Connected to real-time notifications",
      timestamp: new Date().toISOString()
    });
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: any) {
    // Handle client messages (e.g., subscription preferences, ping)
    if (data.type === "ping") {
      this.sendToClient(ws, { type: "pong", timestamp: new Date().toISOString() });
    }
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (ws.userId) {
      const userSockets = this.clients.get(ws.userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
      console.log(`WebSocket client disconnected: ${ws.userId}`);
    }
  }

  private startHeartbeat() {
    // Send ping every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast a notification to a specific user
   */
  public notifyUser(userId: string, notification: any) {
    const userSockets = this.clients.get(userId);
    if (userSockets && userSockets.size > 0) {
      const message = JSON.stringify({
        type: "notification",
        data: notification,
        timestamp: new Date().toISOString()
      });

      userSockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });

      console.log(`Notification sent to user ${userId} (${userSockets.size} connections)`);
      return true;
    }
    return false;
  }

  /**
   * Broadcast a notification to multiple users
   */
  public notifyUsers(userIds: string[], notification: any) {
    let sentCount = 0;
    userIds.forEach(userId => {
      if (this.notifyUser(userId, notification)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  /**
   * Broadcast to all connected clients
   */
  public broadcast(notification: any) {
    const message = JSON.stringify({
      type: "notification",
      data: notification,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;
    this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });

    console.log(`Broadcast notification sent to ${sentCount} clients`);
    return sentCount;
  }

  /**
   * Get number of connected clients for a user
   */
  public getUserConnectionCount(userId: string): number {
    return this.clients.get(userId)?.size || 0;
  }

  /**
   * Get total number of connected clients
   */
  public getTotalConnectionCount(): number {
    return this.wss.clients.size;
  }

  /**
   * Cleanup on server shutdown
   */
  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
    console.log("WebSocket server shut down");
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

export function initializeWebSocketService(server: Server): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(server);
  }
  return wsService;
}

export function getWebSocketService(): WebSocketService | null {
  return wsService;
}

import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage, Server } from "http";
import { parse } from "url";
import session from "express-session";
import { metricsService, type RealtimeMetricUpdate } from "./metricsService";
import type { MonitoringDashboardMetrics } from "@shared/monitoring";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from './logger.service';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

/**
 * Helper function to get user by ID with role check
 */
async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, role: true },
  });
  return user;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsSubscribers: Set<string> = new Set();
  private metricsInterval: NodeJS.Timeout | null = null;
  private sessionParser: any;

  constructor(server: Server, sessionMiddleware: any) {
    this.sessionParser = sessionMiddleware;
    
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/notifications",
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startMetricsBroadcast();

    logger.info("WebSocket server initialized on /ws/notifications");
  }

  private verifyClient(info: any, callback: (result: boolean, code?: number, message?: string) => void) {
    // Parse the session from the request
    this.sessionParser(info.req, {} as any, () => {
      const session = (info.req as any).session;
      
      if (!session || !session.passport?.user) {
        logger.error("WebSocket connection rejected: not authenticated");
        callback(false, 401, "Unauthorized");
        return;
      }

      // Store the authenticated user ID on the request for later use
      (info.req as any).authenticatedUserId = session.passport.user;
      callback(true);
    });
  }

  private handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
    const userId = (req as any).authenticatedUserId;

    if (!userId) {
      logger.error("WebSocket connection rejected: missing authenticated userId");
      ws.close(1008, "Authentication required");
      return;
    }

    // Store connection
    ws.userId = userId;
    ws.isAlive = true;

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);

    logger.info(`WebSocket client connected`, { userId });

    // Set up ping/pong for connection health
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(ws, data);
      } catch (error) {
        logger.error("WebSocket message parse error", { error });
      }
    });

    ws.on("close", () => {
      this.handleDisconnect(ws);
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", { error, userId: ws.userId });
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
    switch (data.type) {
      case "ping":
        this.sendToClient(ws, { type: "pong", timestamp: new Date().toISOString() });
        break;
      case "subscribe_metrics":
        if (ws.userId) {
          this.handleMetricsSubscribe(ws, ws.userId);
        }
        break;
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
      
      // Remove from metrics subscribers if no more connections
      if (!this.clients.has(ws.userId)) {
        this.metricsSubscribers.delete(ws.userId);
      }
      
      logger.info(`WebSocket client disconnected`, { userId: ws.userId });
    }
  }

  private startHeartbeat() {
    // Send ping every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      let activeConnections = 0;
      let deadConnections = 0;
      
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          deadConnections++;
          logger.warn(`WebSocket: Terminating dead connection`, { userId: ws.userId || 'unknown' });
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
        activeConnections++;
      });
      
      if (deadConnections > 0) {
        logger.info(`WebSocket Heartbeat`, { activeConnections, deadConnections });
      }
    }, 30000);
  }

  /**
   * Start broadcasting metrics to subscribed admins
   */
  private startMetricsBroadcast() {
    this.metricsInterval = setInterval(async () => {
      if (this.metricsSubscribers.size === 0) return; // Skip if no subscribers
      
      try {
        const metrics = await metricsService.getAllMetrics();
        this.broadcastMetrics(metrics);
      } catch (error) {
        logger.error('Metrics broadcast error', { error });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Broadcast metrics to subscribed admin users
   */
  public broadcastMetrics(metrics: MonitoringDashboardMetrics) {
    const payload = {
      type: 'metrics_update',
      data: metrics,
      timestamp: new Date().toISOString(),
    };

    // Send metrics directly without double-wrapping in notification envelope
    this.metricsSubscribers.forEach((userId) => {
      const userSockets = this.clients.get(userId);
      if (userSockets && userSockets.size > 0) {
        const message = JSON.stringify(payload);
        userSockets.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        });
      }
    });
  }

  /**
   * Handle metrics subscription from client
   */
  private async handleMetricsSubscribe(ws: AuthenticatedWebSocket, userId: string) {
    // Verify admin role
    const user = await getUserById(userId);
    if (user?.role !== 'admin') {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Unauthorized: Admin role required for metrics' 
      }));
      return;
    }

    this.metricsSubscribers.add(userId);
    
    // Send immediate snapshot
    try {
      const metrics = await metricsService.getAllMetrics();
      ws.send(JSON.stringify({
        type: 'metrics_snapshot',
        data: metrics,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Error sending metrics snapshot', { error, userId });
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch metrics snapshot',
      }));
    }
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

      logger.info(`Notification sent to user`, { userId, connectionCount: userSockets.size });
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

    logger.info(`Broadcast notification sent`, { clientCount: sentCount });
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
   * Get connection health status
   */
  public getConnectionHealth(): {
    totalConnections: number;
    activeConnections: number;
    uniqueUsers: number;
    metricsSubscribers: number;
  } {
    let activeConnections = 0;
    
    this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive !== false && ws.readyState === WebSocket.OPEN) {
        activeConnections++;
      }
    });
    
    return {
      totalConnections: this.wss.clients.size,
      activeConnections,
      uniqueUsers: this.clients.size,
      metricsSubscribers: this.metricsSubscribers.size,
    };
  }

  /**
   * Cleanup on server shutdown
   */
  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.wss.close();
    logger.info("WebSocket server shut down");
  }
}

// Singleton instance
let wsService: WebSocketService | null = null;

export function initializeWebSocketService(server: Server, sessionMiddleware: any): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(server, sessionMiddleware);
  }
  return wsService;
}

export function getWebSocketService(): WebSocketService | null {
  return wsService;
}

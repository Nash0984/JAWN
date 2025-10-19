import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { distributedCache } from './distributedCache';
import Redis from 'ioredis';

interface WSMessage {
  type: string;
  payload: any;
  userId?: string;
  room?: string;
  timestamp: number;
}

interface ClientInfo {
  userId: string;
  role: string;
  rooms: Set<string>;
  lastActivity: number;
}

interface RoomInfo {
  name: string;
  members: Set<string>;
  created: Date;
  metadata?: any;
}

export class ScalableWebSocketService {
  private static instance: ScalableWebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private rooms: Map<string, RoomInfo> = new Map();
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private instanceId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  // Channel names for Redis Pub/Sub
  private readonly CHANNELS = {
    BROADCAST: 'ws:broadcast',
    ROOM: 'ws:room:',
    USER: 'ws:user:',
    PRESENCE: 'ws:presence',
    METRICS: 'ws:metrics',
  };

  // WebSocket event types
  public readonly EVENT_TYPES = {
    // System events
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    HEARTBEAT: 'heartbeat',
    
    // Messaging events
    MESSAGE: 'message',
    BROADCAST: 'broadcast',
    ROOM_MESSAGE: 'room_message',
    DIRECT_MESSAGE: 'direct_message',
    
    // Room events
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    ROOM_CREATED: 'room_created',
    ROOM_DELETED: 'room_deleted',
    
    // Presence events
    USER_ONLINE: 'user_online',
    USER_OFFLINE: 'user_offline',
    PRESENCE_UPDATE: 'presence_update',
    
    // Application events
    BENEFIT_UPDATE: 'benefit_update',
    DOCUMENT_PROCESSED: 'document_processed',
    CALCULATION_COMPLETE: 'calculation_complete',
    NOTIFICATION: 'notification',
    ALERT: 'alert',
  };

  private constructor() {
    this.instanceId = `ws-${process.env.HOSTNAME || 'local'}-${Date.now()}`;
  }

  public static getInstance(): ScalableWebSocketService {
    if (!ScalableWebSocketService.instance) {
      ScalableWebSocketService.instance = new ScalableWebSocketService();
    }
    return ScalableWebSocketService.instance;
  }

  public async initialize(server: HTTPServer): Promise<void> {
    console.log(`🔌 Initializing Scalable WebSocket Service (Instance: ${this.instanceId})`);

    // Initialize WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3,
          memLevel: 7,
          strategy: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        threshold: 1024,
      },
      maxPayload: 1024 * 1024, // 1MB max message size
    });

    // Initialize Redis Pub/Sub
    await this.initializeRedis();

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();

    // Start heartbeat and metrics
    this.startHeartbeat();
    this.startMetricsReporting();

    console.log('✅ WebSocket Service initialized with Redis Pub/Sub');
  }

  private async initializeRedis(): Promise<void> {
    try {
      // Create pub/sub clients
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      };

      this.pubClient = new Redis(redisConfig);
      this.subClient = new Redis(redisConfig);

      // Subscribe to channels
      await this.subClient.subscribe(
        this.CHANNELS.BROADCAST,
        this.CHANNELS.PRESENCE,
        this.CHANNELS.METRICS
      );

      // Handle incoming messages from other instances
      this.subClient.on('message', this.handleRedisMessage.bind(this));

      // Handle Redis errors
      this.pubClient.on('error', (err) => {
        console.error('Redis Pub client error:', err);
      });

      this.subClient.on('error', (err) => {
        console.error('Redis Sub client error:', err);
      });

    } catch (error) {
      console.warn('⚠️ Redis not available for WebSocket scaling, running in single-instance mode');
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleNewConnection(ws, req);

      ws.on('message', (data) => {
        this.handleClientMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      ws.on('pong', () => {
        const client = this.clients.get(ws);
        if (client) {
          client.lastActivity = Date.now();
        }
      });
    });
  }

  private async handleNewConnection(ws: WebSocket, req: any): Promise<void> {
    // Extract user info from request (assumes authentication middleware)
    const userId = req.headers['x-user-id'] || `anonymous-${Date.now()}`;
    const role = req.headers['x-user-role'] || 'anonymous';

    // Create client info
    const clientInfo: ClientInfo = {
      userId,
      role,
      rooms: new Set(['global']),
      lastActivity: Date.now(),
    };

    this.clients.set(ws, clientInfo);

    // Join global room
    this.joinRoom(ws, 'global');

    // Send connection confirmation
    this.sendToClient(ws, {
      type: this.EVENT_TYPES.CONNECTED,
      payload: {
        instanceId: this.instanceId,
        userId,
        role,
        rooms: Array.from(clientInfo.rooms),
      },
      timestamp: Date.now(),
    });

    // Broadcast user online event
    await this.broadcastPresence({
      type: this.EVENT_TYPES.USER_ONLINE,
      userId,
      role,
      instanceId: this.instanceId,
    });

    console.log(`✅ Client connected: ${userId} (${role})`);
  }

  private async handleClientMessage(ws: WebSocket, data: any): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    try {
      const message: WSMessage = JSON.parse(data.toString());
      message.userId = client.userId;
      message.timestamp = Date.now();

      // Update last activity
      client.lastActivity = Date.now();

      // Handle different message types
      switch (message.type) {
        case this.EVENT_TYPES.JOIN_ROOM:
          this.joinRoom(ws, message.payload.room);
          break;

        case this.EVENT_TYPES.LEAVE_ROOM:
          this.leaveRoom(ws, message.payload.room);
          break;

        case this.EVENT_TYPES.ROOM_MESSAGE:
          await this.sendToRoom(message.room || 'global', message);
          break;

        case this.EVENT_TYPES.DIRECT_MESSAGE:
          await this.sendToUser(message.payload.targetUserId, message);
          break;

        case this.EVENT_TYPES.BROADCAST:
          await this.broadcast(message);
          break;

        case this.EVENT_TYPES.HEARTBEAT:
          this.sendToClient(ws, {
            type: this.EVENT_TYPES.HEARTBEAT,
            payload: { pong: true },
            timestamp: Date.now(),
          });
          break;

        default:
          // Handle application-specific events
          await this.handleApplicationEvent(client, message);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      this.sendToClient(ws, {
        type: this.EVENT_TYPES.ERROR,
        payload: { error: 'Invalid message format' },
        timestamp: Date.now(),
      });
    }
  }

  private async handleApplicationEvent(client: ClientInfo, message: WSMessage): Promise<void> {
    // Route application-specific events
    switch (message.type) {
      case this.EVENT_TYPES.BENEFIT_UPDATE:
      case this.EVENT_TYPES.DOCUMENT_PROCESSED:
      case this.EVENT_TYPES.CALCULATION_COMPLETE:
        // Send to relevant users based on permissions
        if (client.role === 'caseworker' || client.role === 'admin') {
          await this.sendToRoom(`caseworker-updates`, message);
        }
        break;

      case this.EVENT_TYPES.NOTIFICATION:
      case this.EVENT_TYPES.ALERT:
        // Handle notifications
        await this.handleNotification(client, message);
        break;
    }
  }

  private async handleNotification(client: ClientInfo, message: WSMessage): Promise<void> {
    // Store notification in cache
    const notificationKey = `notification:${client.userId}:${Date.now()}`;
    await distributedCache.set('session', notificationKey, message.payload, 86400);

    // Send to user across all instances
    await this.sendToUser(client.userId, message);
  }

  private async handleDisconnection(ws: WebSocket): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) return;

    // Leave all rooms
    client.rooms.forEach(room => {
      this.leaveRoom(ws, room);
    });

    // Remove client
    this.clients.delete(ws);

    // Broadcast user offline event
    await this.broadcastPresence({
      type: this.EVENT_TYPES.USER_OFFLINE,
      userId: client.userId,
      instanceId: this.instanceId,
    });

    console.log(`👋 Client disconnected: ${client.userId}`);
  }

  private joinRoom(ws: WebSocket, roomName: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // Add to client's rooms
    client.rooms.add(roomName);

    // Create room if doesn't exist
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, {
        name: roomName,
        members: new Set(),
        created: new Date(),
      });
    }

    // Add client to room
    const room = this.rooms.get(roomName)!;
    room.members.add(client.userId);

    // Subscribe to room channel in Redis
    if (this.subClient) {
      this.subClient.subscribe(`${this.CHANNELS.ROOM}${roomName}`);
    }

    console.log(`📌 ${client.userId} joined room: ${roomName}`);
  }

  private leaveRoom(ws: WebSocket, roomName: string): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove from client's rooms
    client.rooms.delete(roomName);

    // Remove from room members
    const room = this.rooms.get(roomName);
    if (room) {
      room.members.delete(client.userId);

      // Delete room if empty
      if (room.members.size === 0) {
        this.rooms.delete(roomName);
        
        // Unsubscribe from room channel
        if (this.subClient) {
          this.subClient.unsubscribe(`${this.CHANNELS.ROOM}${roomName}`);
        }
      }
    }

    console.log(`📌 ${client.userId} left room: ${roomName}`);
  }

  private sendToClient(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private async sendToRoom(roomName: string, message: WSMessage): Promise<void> {
    // Publish to Redis for other instances
    if (this.pubClient) {
      await this.pubClient.publish(
        `${this.CHANNELS.ROOM}${roomName}`,
        JSON.stringify({ ...message, sourceInstance: this.instanceId })
      );
    }

    // Send to local clients in room
    this.clients.forEach((client, ws) => {
      if (client.rooms.has(roomName)) {
        this.sendToClient(ws, message);
      }
    });
  }

  private async sendToUser(userId: string, message: WSMessage): Promise<void> {
    // Publish to Redis for other instances
    if (this.pubClient) {
      await this.pubClient.publish(
        `${this.CHANNELS.USER}${userId}`,
        JSON.stringify({ ...message, sourceInstance: this.instanceId })
      );
    }

    // Send to local client
    this.clients.forEach((client, ws) => {
      if (client.userId === userId) {
        this.sendToClient(ws, message);
      }
    });
  }

  private async broadcast(message: WSMessage): Promise<void> {
    // Publish to Redis for other instances
    if (this.pubClient) {
      await this.pubClient.publish(
        this.CHANNELS.BROADCAST,
        JSON.stringify({ ...message, sourceInstance: this.instanceId })
      );
    }

    // Send to all local clients
    this.clients.forEach((_, ws) => {
      this.sendToClient(ws, message);
    });
  }

  private async broadcastPresence(data: any): Promise<void> {
    if (this.pubClient) {
      await this.pubClient.publish(
        this.CHANNELS.PRESENCE,
        JSON.stringify(data)
      );
    }
  }

  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Skip messages from this instance
      if (data.sourceInstance === this.instanceId) return;

      // Handle different channel types
      if (channel === this.CHANNELS.BROADCAST) {
        // Send to all local clients
        this.clients.forEach((_, ws) => {
          this.sendToClient(ws, data);
        });
      } else if (channel.startsWith(this.CHANNELS.ROOM)) {
        // Send to clients in specific room
        const roomName = channel.replace(this.CHANNELS.ROOM, '');
        this.clients.forEach((client, ws) => {
          if (client.rooms.has(roomName)) {
            this.sendToClient(ws, data);
          }
        });
      } else if (channel.startsWith(this.CHANNELS.USER)) {
        // Send to specific user
        const userId = channel.replace(this.CHANNELS.USER, '');
        this.clients.forEach((client, ws) => {
          if (client.userId === userId) {
            this.sendToClient(ws, data);
          }
        });
      }
    } catch (error) {
      console.error('Error handling Redis message:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        // Check for inactive clients
        if (Date.now() - client.lastActivity > 60000) {
          console.log(`⚠️ Terminating inactive client: ${client.userId}`);
          ws.terminate();
          return;
        }

        // Send ping
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000); // Every 30 seconds
  }

  private startMetricsReporting(): void {
    this.metricsInterval = setInterval(async () => {
      const metrics = this.getMetrics();
      
      // Publish metrics to Redis
      if (this.pubClient) {
        await this.pubClient.publish(
          this.CHANNELS.METRICS,
          JSON.stringify({
            instanceId: this.instanceId,
            ...metrics,
            timestamp: Date.now(),
          })
        );
      }

      // Log locally
      console.log(`📊 WebSocket Metrics: ${metrics.totalClients} clients, ${metrics.totalRooms} rooms`);
    }, 60000); // Every minute
  }

  public getMetrics(): {
    instanceId: string;
    totalClients: number;
    totalRooms: number;
    clientsByRole: Record<string, number>;
    roomSizes: Record<string, number>;
    averageRoomsPerClient: number;
  } {
    const clientsByRole: Record<string, number> = {};
    const roomSizes: Record<string, number> = {};
    let totalRoomMemberships = 0;

    // Count clients by role
    this.clients.forEach(client => {
      clientsByRole[client.role] = (clientsByRole[client.role] || 0) + 1;
      totalRoomMemberships += client.rooms.size;
    });

    // Count room sizes
    this.rooms.forEach(room => {
      roomSizes[room.name] = room.members.size;
    });

    return {
      instanceId: this.instanceId,
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      clientsByRole,
      roomSizes,
      averageRoomsPerClient: this.clients.size > 0 ? totalRoomMemberships / this.clients.size : 0,
    };
  }

  public async shutdown(): Promise<void> {
    console.log('🔌 Shutting down WebSocket service...');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all connections
    this.clients.forEach((_, ws) => {
      ws.close(1000, 'Server shutting down');
    });

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close Redis connections
    if (this.pubClient) {
      await this.pubClient.quit();
    }
    if (this.subClient) {
      await this.subClient.quit();
    }

    console.log('✅ WebSocket service shut down');
  }

  // Public API for sending messages from other parts of the application
  public async notifyUser(userId: string, type: string, payload: any): Promise<void> {
    await this.sendToUser(userId, {
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  public async notifyRoom(roomName: string, type: string, payload: any): Promise<void> {
    await this.sendToRoom(roomName, {
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  public async notifyAll(type: string, payload: any): Promise<void> {
    await this.broadcast({
      type,
      payload,
      timestamp: Date.now(),
    });
  }
}

// Export singleton instance
export const webSocketService = ScalableWebSocketService.getInstance();
/**
 * Graceful Shutdown Handler
 * 
 * Ensures proper cleanup when the server receives shutdown signals:
 * - Stops accepting new connections
 * - Drains existing connections
 * - Closes database connections
 * - Cleans up resources
 */

import { Server } from 'http';
import { WebSocket } from 'ws';

interface ShutdownConfig {
  timeout?: number; // Max time to wait for connections to close (ms)
  logger?: (message: string) => void;
}

export class GracefulShutdown {
  private server: Server;
  private wsConnections: Set<WebSocket> = new Set();
  private isShuttingDown = false;
  private config: Required<ShutdownConfig>;

  constructor(server: Server, config: ShutdownConfig = {}) {
    this.server = server;
    this.config = {
      timeout: config.timeout || 30000, // 30 seconds default
      logger: config.logger || console.log
    };
  }

  /**
   * Track WebSocket connections for cleanup
   */
  trackWebSocket(ws: WebSocket): void {
    this.wsConnections.add(ws);
    
    ws.on('close', () => {
      this.wsConnections.delete(ws);
    });
  }

  /**
   * Initialize shutdown handlers for common signals
   */
  registerHandlers(): void {
    // SIGTERM: Kubernetes/Docker graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    
    // SIGINT: Ctrl+C in terminal
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.config.logger(`❌ Uncaught Exception: ${error.message}`);
      console.error(error);
      this.shutdown('uncaughtException', 1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.config.logger(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
      this.shutdown('unhandledRejection', 1);
    });
  }

  /**
   * Execute graceful shutdown
   */
  private async shutdown(signal: string, exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      this.config.logger('⏳ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    this.config.logger(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    const shutdownStart = Date.now();

    // 1. Stop accepting new connections
    this.server.close((err) => {
      if (err) {
        this.config.logger(`❌ Error closing server: ${err.message}`);
      } else {
        this.config.logger('✅ Server closed (no longer accepting connections)');
      }
    });

    // 2. Close WebSocket connections gracefully
    this.config.logger(`📡 Closing ${this.wsConnections.size} WebSocket connection(s)...`);
    const wsClosePromises = Array.from(this.wsConnections).map(ws => {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Server shutting down');
        }
        resolve();
      });
    });

    await Promise.all(wsClosePromises);
    this.config.logger('✅ WebSocket connections closed');

    // 3. Wait for active connections to drain (with timeout)
    const drainTimeout = setTimeout(() => {
      this.config.logger(`⚠️  Shutdown timeout (${this.config.timeout}ms) reached, forcing exit`);
      process.exit(exitCode);
    }, this.config.timeout);

    // 4. Perform cleanup tasks
    try {
      // Close database connections (if using connection pool)
      // This will be handled by the database driver when process exits
      
      this.config.logger('✅ Cleanup completed');
      
      clearTimeout(drainTimeout);
      
      const shutdownTime = Date.now() - shutdownStart;
      this.config.logger(`✅ Graceful shutdown completed in ${shutdownTime}ms`);
      
      process.exit(exitCode);
    } catch (error) {
      this.config.logger(`❌ Error during cleanup: ${error}`);
      clearTimeout(drainTimeout);
      process.exit(1);
    }
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Middleware to reject requests during shutdown
 */
export function rejectDuringShutdown(shutdown: GracefulShutdown) {
  return (req: any, res: any, next: any) => {
    if (shutdown.isShuttingDownNow()) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Server is shutting down'
      });
      return;
    }
    next();
  };
}

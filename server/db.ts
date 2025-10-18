import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-grade connection pooling configuration
// Optimized for 5000+ concurrent users
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of connections in pool
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum number of connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // 2 seconds
  maxUses: parseInt(process.env.DB_MAX_USES || '7500'), // Max uses per connection before recycling
  
  // Performance optimizations
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30 seconds
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds
  
  // Connection string options for better performance
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  keepAlive: true,
  keepAliveInitialDelayMillis: parseInt(process.env.DB_KEEPALIVE_DELAY || '10000'), // 10 seconds
});

// Log pool events in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    console.log('🔗 New database connection established');
  });
  
  pool.on('remove', () => {
    console.log('🔌 Database connection removed from pool');
  });
  
  pool.on('error', (err) => {
    console.error('❌ Database pool error:', err);
  });
}

// Monitor pool statistics
export async function getPoolStats() {
  return {
    totalCount: pool.totalCount,     // Total connections created
    idleCount: pool.idleCount,       // Available idle connections
    waitingCount: pool.waitingCount, // Number of queued requests
  };
}

// Graceful shutdown handler
export async function closePool() {
  try {
    await pool.end();
    console.log('✅ Database connection pool closed gracefully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
}

export const db = drizzle({ client: pool, schema });
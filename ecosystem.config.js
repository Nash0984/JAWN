/**
 * PM2 Configuration for Production Deployment
 * Supports 5000+ concurrent users with auto-scaling and clustering
 */

module.exports = {
  apps: [
    {
      // Main Application
      name: 'jawn-api',
      script: './server/index.ts',
      interpreter: 'tsx',
      instances: process.env.PM2_INSTANCES || 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      max_memory_restart: '2G',
      
      // Environment Variables
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Logging
      error_file: './logs/pm2/error.log',
      out_file: './logs/pm2/out.log',
      log_file: './logs/pm2/combined.log',
      time: true,
      merge_logs: true,
      
      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Performance monitoring
      pmx: true,
      instance_var: 'INSTANCE_ID',
      
      // Cluster settings
      wait_ready: true,
      
      // Environment-specific configurations
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000,
        
        // Database pooling for production
        DB_POOL_MAX: 100,
        DB_POOL_MIN: 10,
        DB_IDLE_TIMEOUT: 30000,
        DB_CONNECTION_TIMEOUT: 5000,
        DB_STATEMENT_TIMEOUT: 30000,
        DB_QUERY_TIMEOUT: 30000,
        DB_MAX_QUEUE: 1000,
        DB_QUEUE_TIMEOUT: 10000,
        
        // Redis configuration
        REDIS_HOST: process.env.REDIS_HOST || 'localhost',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        REDIS_CLUSTER_MODE: 'true',
        
        // Cache settings
        CACHE_DEFAULT_TTL: 300,
        CACHE_DOCUMENTS_TTL: 86400,
        CACHE_CALCULATIONS_TTL: 3600,
        CACHE_SESSIONS_TTL: 1800,
        CACHE_METRICS_TTL: 60,
        
        // Rate limiting (requests per minute)
        RATE_LIMIT_STANDARD: 100,
        RATE_LIMIT_AUTH: 5,
        RATE_LIMIT_AI: 20,
        RATE_LIMIT_UPLOAD: 10,
        RATE_LIMIT_ADMIN: 1000,
        
        // Request limits
        MAX_REQUEST_SIZE_MB: 10,
        MAX_JSON_SIZE_MB: 5,
        MAX_URL_LENGTH: 2048,
        REQUEST_TIMEOUT: 30000,
        
        // WebSocket configuration
        WS_MAX_PAYLOAD: 1048576, // 1MB
        WS_HEARTBEAT_INTERVAL: 30000,
        WS_MAX_CONNECTIONS_PER_USER: 5,
        
        // Performance settings
        UV_THREADPOOL_SIZE: 128,
        
        // Monitoring
        PROMETHEUS_ENABLED: 'true',
        METRICS_PORT: 9090,
        
        // Security
        HELMET_ENABLED: 'true',
        CORS_ENABLED: 'true',
        CSRF_ENABLED: 'true',
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: process.env.PORT || 5000,
        DB_POOL_MAX: 50,
        DB_POOL_MIN: 5,
        RATE_LIMIT_STANDARD: 200,
      },
      
      env_development: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 5000,
        DB_POOL_MAX: 20,
        DB_POOL_MIN: 2,
      },
    },
    
    // Worker Process for Background Jobs
    {
      name: 'jawn-worker',
      script: './server/workers/backgroundWorker.ts',
      interpreter: 'tsx',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'background',
      },
      
      autorestart: true,
      watch: false,
      
      error_file: './logs/pm2/worker-error.log',
      out_file: './logs/pm2/worker-out.log',
      log_file: './logs/pm2/worker-combined.log',
      time: true,
    },
    
    // Scheduler Process
    {
      name: 'jawn-scheduler',
      script: './server/workers/scheduler.ts',
      interpreter: 'tsx',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'scheduler',
      },
      
      autorestart: true,
      watch: false,
      
      error_file: './logs/pm2/scheduler-error.log',
      out_file: './logs/pm2/scheduler-out.log',
      log_file: './logs/pm2/scheduler-combined.log',
      time: true,
      
      cron_restart: '0 0 * * *', // Restart daily at midnight
    },
  ],
  
  // Deployment Configuration
  deploy: {
    production: {
      user: 'deploy',
      host: process.env.DEPLOY_HOST,
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO,
      path: '/var/www/jawn',
      'pre-deploy': 'npm run build',
      'post-deploy': 'npm install && npm run db:push && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'npm install pm2 -g',
    },
    
    staging: {
      user: 'deploy',
      host: process.env.STAGING_HOST,
      ref: 'origin/staging',
      repo: process.env.DEPLOY_REPO,
      path: '/var/www/jawn-staging',
      'pre-deploy': 'npm run build',
      'post-deploy': 'npm install && npm run db:push && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
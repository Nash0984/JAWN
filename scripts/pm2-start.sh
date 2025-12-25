#!/bin/bash

# PM2 Production Startup Script
# Starts the JAWN application with PM2 in cluster mode

echo "🚀 Starting JAWN with PM2..."

# Create log directory if it doesn't exist
mkdir -p logs/pm2

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
fi

# Stop any existing PM2 processes
echo "🛑 Stopping existing PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Start the application with PM2
echo "🔧 Starting application in ${NODE_ENV:-production} mode..."
pm2 start ecosystem.config.js --env ${NODE_ENV:-production}

# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Display status
echo "✅ Application started successfully!"
echo ""
pm2 status
echo ""
echo "📊 Monitoring commands:"
echo "  pm2 status       - View process status"
echo "  pm2 logs         - View all logs"
echo "  pm2 logs jawn-api - View API logs"
echo "  pm2 monit        - Real-time monitoring"
echo "  pm2 web          - Web dashboard (port 9615)"
echo ""
echo "🔄 Management commands:"
echo "  pm2 reload all   - Zero-downtime reload"
echo "  pm2 restart all  - Restart all processes"
echo "  pm2 scale jawn-api 8 - Scale to 8 instances"
echo "  pm2 stop all     - Stop all processes"
echo ""
echo "📈 Metrics endpoint: http://localhost:9090/metrics"
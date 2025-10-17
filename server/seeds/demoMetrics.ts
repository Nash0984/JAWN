import { db } from '../db';
import { monitoringMetrics, alertHistory, alertRules, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function seedDemoMetrics() {
  console.log('🌱 Seeding demo metrics data...');
  
  // Seed monitoring metrics (last 24 hours)
  const now = Date.now();
  const metrics = [];
  
  // Error metrics
  for (let i = 0; i < 24; i++) {
    metrics.push({
      metricType: 'error',
      metricValue: Math.floor(Math.random() * 50) + 10,
      metadata: { errorType: 'ValidationError', endpoint: '/api/households' },
      timestamp: new Date(now - (i * 3600000)), // Hourly
    });
  }
  
  // Response time metrics
  for (let i = 0; i < 24; i++) {
    metrics.push({
      metricType: 'response_time',
      metricValue: Math.random() * 500 + 100,
      metadata: { endpoint: '/api/metrics', method: 'GET' },
      timestamp: new Date(now - (i * 3600000)),
    });
  }
  
  // Cache hit rate metrics
  for (let i = 0; i < 24; i++) {
    metrics.push({
      metricType: 'cache_hit_rate',
      metricValue: Math.random() * 30 + 60, // 60-90%
      metadata: { cacheLayer: 'L1-embedding' },
      timestamp: new Date(now - (i * 3600000)),
    });
  }
  
  await db.insert(monitoringMetrics).values(metrics).onConflictDoNothing();
  console.log(`✅ Created ${metrics.length} monitoring metrics`);
  
  // Seed alert history
  await db.insert(alertHistory).values([
    {
      alertType: 'error_rate',
      severity: 'critical',
      message: 'Error rate exceeded 50 errors/hour',
      channels: ['email', 'in_app'],
      resolved: true,
      resolvedAt: new Date(now - 7200000),
    },
    {
      alertType: 'slow_response',
      severity: 'warning',
      message: 'API response time >500ms detected',
      channels: ['in_app'],
      resolved: false,
    },
  ]).onConflictDoNothing();
  console.log('✅ Created 2 alert history entries');
  
  // Seed demo alert rules
  const adminUser = await db.query.users.findFirst({
    where: eq(users.role, 'admin')
  });
  
  if (adminUser) {
    await db.insert(alertRules).values([
      {
        name: 'High Error Rate',
        metricType: 'error_rate',
        threshold: 50,
        comparison: 'greater_than',
        severity: 'critical',
        channels: ['email', 'in_app'],
        enabled: true,
        cooldownMinutes: 30,
        recipientRoles: ['admin'],
        createdBy: adminUser.id,
      },
      {
        name: 'Slow API Response',
        metricType: 'response_time',
        threshold: 500,
        comparison: 'greater_than',
        severity: 'warning',
        channels: ['in_app'],
        enabled: true,
        cooldownMinutes: 15,
        recipientRoles: ['admin'],
        createdBy: adminUser.id,
      },
      {
        name: 'Low Cache Hit Rate',
        metricType: 'cache_hit_rate',
        threshold: 50,
        comparison: 'less_than',
        severity: 'warning',
        channels: ['in_app'],
        enabled: false, // Disabled for demo
        cooldownMinutes: 60,
        recipientRoles: ['admin'],
        createdBy: adminUser.id,
      },
    ]).onConflictDoNothing();
    console.log('✅ Created 3 demo alert rules (2 enabled, 1 disabled)');
  } else {
    console.warn('⚠️  No admin user found - skipping alert rules seeding');
  }
  
  console.log('✅ Demo metrics seeding complete');
}

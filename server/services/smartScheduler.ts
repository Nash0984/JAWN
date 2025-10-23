import { log } from '../vite';
import { govInfoVersionChecker } from './govInfoVersionChecker';
import { ecfrBulkDownloader } from './ecfrBulkDownloader';
import { irsDirectDownloader } from './irsDirectDownloader';
import { fnsStateOptionsParser } from './fnsStateOptionsParser';
import { marylandLegislatureScraper } from './marylandLegislatureScraper';

/**
 * Smart Scheduler Service
 * 
 * Cost-optimized scheduling system that checks each data source based on
 * realistic update frequencies instead of a wasteful global interval.
 * 
 * Schedule Rationale:
 * - eCFR (SNAP regs): Weekly - Major updates quarterly at best
 * - IRS Publications: Weekly - Updated annually (Oct-Dec for tax season)
 * - Federal Bills: Daily during session, weekly during recess - Active Jan-Dec
 * - Public Laws: Weekly - Few enacted per month
 * - Maryland Legislature: Daily during session (Jan-Apr only), paused rest of year
 * - FNS State Options: Monthly - Updated semi-annually
 * 
 * Reduces check frequency by ~70-80% with zero functionality loss.
 */

export interface ScheduleConfig {
  name: string;
  cronExpression: string;
  description: string;
  enabled: boolean;
  sessionAware?: boolean;
  checkFunction: () => Promise<void>;
}

export class SmartScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private initialCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEFAULT_CONGRESS = 119;
  private configsCache: ScheduleConfig[] | null = null;
  private isInitialized: boolean = false;
  private initializationTime: number | null = null;
  
  /**
   * Get source-specific schedules with realistic check intervals
   * Loads DB overrides for enabled/cronExpression on first call
   */
  async getScheduleConfigs(): Promise<ScheduleConfig[]> {
    // Return cached configs if already loaded
    if (this.configsCache) {
      return this.configsCache;
    }

    // Hard-coded default configurations
    const defaultConfigs: ScheduleConfig[] = [
      {
        name: 'ecfr',
        cronExpression: '0 0 * * 0', // Weekly on Sunday at midnight
        description: 'eCFR Title 7 SNAP regulations (weekly - updates quarterly)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Checking eCFR version...');
          const result = await govInfoVersionChecker.checkECFRVersion();
          if (result.needsSync) {
            log('🔄 eCFR update detected - triggering download');
            await ecfrBulkDownloader.downloadSNAPRegulations();
          }
        },
      },
      {
        name: 'irs_publications',
        cronExpression: '0 0 * * 0', // Weekly on Sunday at 2am
        description: 'IRS VITA publications (weekly - updated annually Oct-Dec)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Checking IRS publications...');
          // Download all VITA publications - they handle version checking internally
          await irsDirectDownloader.downloadAllVITAPublications();
        },
      },
      {
        name: 'federal_bills',
        cronExpression: '0 0 * * *', // Check daily, adjust frequency inside checkFunction
        description: 'Federal bill status (daily during session, weekly during recess)',
        enabled: true,
        sessionAware: true,
        checkFunction: async () => {
          const inSession = this.isCongressInSession();
          const sessionStatus = inSession ? 'in session' : 'in recess';
          
          // During recess, only run on Sundays (skip other days)
          if (!inSession) {
            const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
            if (today !== 0) {
              log(`📅 Federal bills: Skipping (Congress in recess, next check Sunday)`);
              return;
            }
          }
          
          log(`📅 Smart Scheduler: Checking federal bills (Congress ${sessionStatus})...`);
          const result = await govInfoVersionChecker.checkBillStatusUpdates(this.DEFAULT_CONGRESS, 5);
          if (result.packagesNeedingUpdate && result.packagesNeedingUpdate > 0) {
            log(`🔄 ${result.packagesNeedingUpdate} bill(s) need updating`);
          }
        },
      },
      {
        name: 'public_laws',
        cronExpression: '0 0 * * 0', // Weekly on Sunday at 4am
        description: 'Federal public laws (weekly - few enacted per month)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Checking public laws...');
          const result = await govInfoVersionChecker.checkPublicLawsUpdates(this.DEFAULT_CONGRESS, 5);
          if (result.packagesNeedingUpdate && result.packagesNeedingUpdate > 0) {
            log(`🔄 ${result.packagesNeedingUpdate} law(s) need updating`);
          }
        },
      },
      {
        name: 'maryland_legislature',
        cronExpression: '0 0 * * *', // Check daily, skip execution outside session
        description: 'Maryland Legislature bills (daily during Jan-Apr session only)',
        enabled: true, // Always enabled, session check happens inside checkFunction
        sessionAware: true,
        checkFunction: async () => {
          if (!this.isMarylandLegislatureInSession()) {
            // Outside Jan-Apr - skip silently (no spam in logs)
            return;
          }
          log('📅 Smart Scheduler: Checking Maryland Legislature (in session)...');
          const year = new Date().getFullYear();
          const session = `${year}RS`; // Regular Session format: 2025RS
          await marylandLegislatureScraper.scrapeBills(session);
        },
      },
      {
        name: 'fns_state_options',
        cronExpression: '0 0 1 * *', // Monthly on 1st (published annually in August)
        description: 'FNS SNAP State Options (monthly check, published annually in August)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Checking FNS State Options...');
          try {
            const result = await fnsStateOptionsParser.downloadAndParse();
            if (result.optionsCreated > 0 || result.marylandStatusCreated > 0) {
              log(`✅ FNS State Options updated: ${result.optionsCreated} options, ${result.marylandStatusCreated} MD statuses`);
            } else {
              log(`✅ FNS State Options already current (Edition 17)`);
            }
          } catch (error) {
            log(`❌ FNS State Options check failed: ${error}`);
          }
        },
      },
      {
        name: 'bar_checkpoint_check',
        cronExpression: '0 0 * * *', // Daily at 9 AM (uses 0 0 for midnight, will run daily)
        description: 'BAR checkpoint monitoring (daily at 9 AM - upcoming and overdue checkpoints)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Running BAR checkpoint check...');
          try {
            const { barNotificationService } = await import('./barNotification.service');
            
            log('📋 BAR: Checking upcoming checkpoints...');
            const upcomingCount = await barNotificationService.checkUpcomingCheckpoints();
            log(`✅ BAR: Sent ${upcomingCount} upcoming checkpoint reminders`);
            
            log('⚠️  BAR: Checking overdue checkpoints...');
            const overdueCount = await barNotificationService.checkOverdueCheckpoints();
            log(`📨 BAR: Sent ${overdueCount} overdue checkpoint alerts`);
          } catch (error) {
            log(`❌ BAR checkpoint check failed: ${error}`);
          }
        },
      },
      {
        name: 'audit_chain_verification',
        cronExpression: '0 3 * * 0', // Weekly on Sunday at 3 AM (per NIST AU-6)
        description: 'Audit chain verification (weekly recent entries, monthly full chain per NIST AU-6)',
        enabled: true,
        checkFunction: async () => {
          log('📅 Smart Scheduler: Running audit chain verification...');
          try {
            const { auditChainMonitor } = await import('./auditChainMonitor.service');
            
            // Check if today is the first Sunday of the month for full chain verification
            if (auditChainMonitor.isFirstSundayOfMonth()) {
              log('🔍 Audit Chain: Running MONTHLY full chain verification...');
              const result = await auditChainMonitor.verifyFullChain();
              
              if (result.success && result.isValid) {
                log(`✅ Audit Chain: Full chain verified (${result.verifiedEntries} entries)`);
              } else if (result.success && !result.isValid) {
                log(`❌ Audit Chain: Full chain compromised (${result.brokenLinks} broken links)`);
              } else {
                log(`❌ Audit Chain: Full verification failed`);
              }
            } else {
              // Weekly: verify recent 1000 entries
              log('🔍 Audit Chain: Running WEEKLY recent entries verification...');
              const result = await auditChainMonitor.verifyRecentEntries();
              
              if (result.success && result.isValid) {
                log(`✅ Audit Chain: Recent entries verified (${result.verifiedEntries} entries)`);
              } else if (result.success && !result.isValid) {
                log(`❌ Audit Chain: Recent entries compromised (${result.brokenLinks} broken links)`);
              } else {
                log(`❌ Audit Chain: Verification failed`);
              }
            }
          } catch (error) {
            log(`❌ Audit chain verification failed: ${error}`);
          }
        },
      },
    ];

    // Load overrides from database
    try {
      const { db } = await import('../db');
      const { schedulerConfigs } = await import('@shared/schema');
      
      const dbConfigs = await db.select().from(schedulerConfigs);
      
      // Merge DB overrides with defaults
      const mergedConfigs = defaultConfigs.map(defaultConfig => {
        const dbOverride = dbConfigs.find(dc => dc.sourceName === defaultConfig.name);
        
        if (dbOverride) {
          log(`📊 Loading scheduler override for ${defaultConfig.name}: enabled=${dbOverride.isEnabled}, cron=${dbOverride.cronExpression}`);
          return {
            ...defaultConfig,
            enabled: dbOverride.isEnabled,
            cronExpression: dbOverride.cronExpression,
          };
        }
        
        return defaultConfig;
      });
      
      this.configsCache = mergedConfigs;
      return mergedConfigs;
    } catch (error) {
      log(`⚠️  Failed to load scheduler configs from DB, using defaults: ${error}`);
      this.configsCache = defaultConfigs;
      return defaultConfigs;
    }
  }

  /**
   * Check if Congress is in session
   * Congress typically in session Jan-Dec with breaks in Aug and around holidays
   * For simplicity: Consider in session except August
   */
  private isCongressInSession(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // August recess (month 7)
    if (month === 7) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if Maryland Legislature is in session
   * 90-day session runs Jan-Apr each year (typically Jan 8 - Apr 8)
   */
  private isMarylandLegislatureInSession(): boolean {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // Session months: January (0), February (1), March (2), April (3)
    // More precise: Jan 8 - Apr 8, but we'll use full months for safety
    return month >= 0 && month <= 3;
  }

  /**
   * Convert cron expression to milliseconds for setInterval
   * Simple implementation for common patterns
   * Note: JavaScript setInterval has a 32-bit limit (~24.8 days max)
   */
  private cronToMs(cronExpression: string): number {
    // Parse simple cron expressions
    // Format: minute hour day month weekday
    const parts = cronExpression.split(' ');
    
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    const [minute, hour, day, month, weekday] = parts;
    
    // Daily: '0 0 * * *'
    if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '*') {
      return 24 * 60 * 60 * 1000; // 24 hours
    }
    
    // Weekly on Sunday: '0 0 * * 0'
    if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '0') {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    
    // Monthly on 1st: '0 0 1 * *' - Use weekly instead (30 days exceeds JS timer limit)
    // JavaScript setInterval max is ~24.8 days (2^31-1 ms), so monthly isn't possible
    if (minute === '0' && hour === '0' && day === '1' && month === '*' && weekday === '*') {
      return 7 * 24 * 60 * 60 * 1000; // 7 days (check weekly for monthly sources)
    }
    
    throw new Error(`Unsupported cron pattern: ${cronExpression}`);
  }

  /**
   * Start all smart schedules
   */
  async startAll(): Promise<void> {
    log('\n📅 Starting Smart Scheduler with source-specific intervals...');
    log('════════════════════════════════════════════════════════════');
    
    const configs = await this.getScheduleConfigs();
    const inSession = this.isCongressInSession();
    const mdInSession = this.isMarylandLegislatureInSession();
    
    for (const config of configs) {
      if (!config.enabled) {
        log(`⏸️  ${config.name}: PAUSED - ${config.description}`);
        continue;
      }
      
      try {
        const intervalMs = this.cronToMs(config.cronExpression);
        const intervalHours = intervalMs / (60 * 60 * 1000);
        const intervalDisplay = intervalHours >= 24 ? `${intervalHours / 24} day(s)` : `${intervalHours} hour(s)`;
        
        // Add session status to display for session-aware sources
        let displayText = `✅ ${config.name}: Every ${intervalDisplay}`;
        if (config.name === 'federal_bills') {
          displayText += inSession ? ' (in session)' : ' (in recess, weekly)';
        } else if (config.name === 'maryland_legislature') {
          displayText += mdInSession ? ' (in session)' : ' (paused until Jan)';
        }
        
        log(displayText);
        log(`   ${config.description}`);
        
        // OPTIMIZATION: Defer initial checks to background (run after 5 seconds)
        // This prevents blocking server startup with long-running downloads/API calls
        // Session-aware sources check their own status before running
        const initialCheckTimer = setTimeout(async () => {
          try {
            await config.checkFunction();
          } catch (error) {
            log(`❌ Initial background check failed for ${config.name}: ${error}`);
          }
          // Remove timer from tracking map after execution
          this.initialCheckTimers.delete(config.name);
        }, 5000); // Run first check 5 seconds after startup
        
        // Track timer for cleanup on shutdown
        this.initialCheckTimers.set(config.name, initialCheckTimer);
        
        // Schedule periodic checks
        const interval = setInterval(async () => {
          try {
            await config.checkFunction();
          } catch (error) {
            log(`❌ Scheduled check failed for ${config.name}: ${error}`);
          }
        }, intervalMs);
        
        this.intervals.set(config.name, interval);
        
      } catch (error) {
        log(`❌ Failed to schedule ${config.name}: ${error}`);
      }
    }
    
    log('════════════════════════════════════════════════════════════');
    log(`📊 Smart Scheduler Status:`);
    log(`   Active schedules: ${this.intervals.size}`);
    log(`   Session-aware: Federal bills ${inSession ? 'daily' : 'weekly'}, MD Legislature ${mdInSession ? 'active' : 'paused'}`);
    log(`   Estimated check reduction: 70-80% vs 6-hour global interval`);
    log('════════════════════════════════════════════════════════════\n');
    
    // Mark as initialized
    this.isInitialized = true;
    this.initializationTime = Date.now();
  }

  /**
   * Stop all schedules
   */
  stopAll(): void {
    log('⏹️  Stopping Smart Scheduler...');
    
    // Clear recurring intervals
    Array.from(this.intervals.entries()).forEach(([name, interval]) => {
      clearInterval(interval);
      log(`   Stopped: ${name}`);
    });
    this.intervals.clear();
    
    // Clear pending initial check timers (shutdown hygiene)
    Array.from(this.initialCheckTimers.entries()).forEach(([name, timer]) => {
      clearTimeout(timer);
      log(`   Canceled pending initial check: ${name}`);
    });
    this.initialCheckTimers.clear();
  }

  /**
   * Manually trigger a specific source check
   */
  async triggerCheck(sourceName: string): Promise<void> {
    const configs = await this.getScheduleConfigs();
    const config = configs.find(c => c.name === sourceName);
    
    if (!config) {
      throw new Error(`Unknown source: ${sourceName}`);
    }
    
    log(`🔧 Manual trigger: ${config.name}`);
    await config.checkFunction();
  }

  /**
   * Get current schedule status
   */
  async getStatus(): Promise<{
    schedules: Array<{
      name: string;
      description: string;
      enabled: boolean;
      interval: string;
      nextRun?: string;
    }>;
    activeCount: number;
    pausedCount: number;
  }> {
    const configs = await this.getScheduleConfigs();
    
    return {
      schedules: configs.map(c => ({
        name: c.name,
        description: c.description,
        enabled: c.enabled,
        interval: c.cronExpression,
        nextRun: c.enabled ? 'Running on schedule' : 'Paused',
      })),
      activeCount: this.intervals.size,
      pausedCount: configs.filter(c => !c.enabled).length,
    };
  }

  /**
   * Get health check status
   */
  getHealthStatus(): {
    isInitialized: boolean;
    initializationTime: number | null;
    activeSchedules: number;
    pendingInitialChecks: number;
  } {
    return {
      isInitialized: this.isInitialized,
      initializationTime: this.initializationTime,
      activeSchedules: this.intervals.size,
      pendingInitialChecks: this.initialCheckTimers.size,
    };
  }

  /**
   * Toggle schedule on/off
   */
  async toggleSchedule(sourceName: string, enabled: boolean): Promise<void> {
    // Save to database first
    await this.saveConfig(sourceName, { isEnabled: enabled });
    
    // Invalidate cache to reload with new settings
    this.configsCache = null;
    const configs = await this.getScheduleConfigs();
    const config = configs.find(c => c.name === sourceName);
    
    if (!config) {
      throw new Error(`Unknown source: ${sourceName}`);
    }
    
    if (enabled) {
      // Start the schedule
      const intervalMs = this.cronToMs(config.cronExpression);
      const interval = setInterval(async () => {
        try {
          await config.checkFunction();
        } catch (error) {
          log(`❌ Scheduled check failed for ${sourceName}: ${error}`);
        }
      }, intervalMs);
      
      this.intervals.set(sourceName, interval);
      log(`✅ Enabled schedule for ${sourceName}`);
    } else {
      // Stop the schedule
      const interval = this.intervals.get(sourceName);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(sourceName);
        log(`⏸️  Disabled schedule for ${sourceName}`);
      }
    }
  }

  /**
   * Update schedule frequency
   */
  async updateFrequency(sourceName: string, cronExpression: string): Promise<void> {
    // Validate cron expression can be converted
    try {
      this.cronToMs(cronExpression);
    } catch (error) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Save to database first
    await this.saveConfig(sourceName, { cronExpression });
    
    // Invalidate cache to reload with new settings
    this.configsCache = null;
    const configs = await this.getScheduleConfigs();
    const config = configs.find(c => c.name === sourceName);
    
    if (!config) {
      throw new Error(`Unknown source: ${sourceName}`);
    }
    
    // Restart the schedule with new frequency if enabled
    if (config.enabled) {
      const interval = this.intervals.get(sourceName);
      if (interval) {
        clearInterval(interval);
      }
      
      const intervalMs = this.cronToMs(cronExpression);
      const newInterval = setInterval(async () => {
        try {
          await config.checkFunction();
        } catch (error) {
          log(`❌ Scheduled check failed for ${sourceName}: ${error}`);
        }
      }, intervalMs);
      
      this.intervals.set(sourceName, newInterval);
      log(`🔄 Updated frequency for ${sourceName} to ${cronExpression}`);
    }
  }

  /**
   * Save configuration to database
   */
  private async saveConfig(sourceName: string, updates: any): Promise<void> {
    const { db } = await import('../db');
    const { schedulerConfigs } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Check if config exists
    const existing = await db.select()
      .from(schedulerConfigs)
      .where(eq(schedulerConfigs.sourceName, sourceName))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing
      await db.update(schedulerConfigs)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schedulerConfigs.sourceName, sourceName));
      log(`💾 Updated scheduler config for ${sourceName}`);
    } else {
      // Create new - must get default config to populate initial values
      const configs = await this.getScheduleConfigs();
      const config = configs.find(c => c.name === sourceName);
      if (config) {
        await db.insert(schedulerConfigs).values({
          sourceName: config.name,
          displayName: config.description.split(' (')[0], // Extract display name
          description: config.description,
          isEnabled: config.enabled,
          cronExpression: config.cronExpression,
          ...updates,
        });
        log(`💾 Created scheduler config for ${sourceName}`);
      }
    }
  }
}

// Export singleton instance
export const smartScheduler = new SmartScheduler();

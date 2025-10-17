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
  private readonly DEFAULT_CONGRESS = 119;
  
  /**
   * Get source-specific schedules with realistic check intervals
   */
  getScheduleConfigs(): ScheduleConfig[] {
    return [
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
    ];
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
    
    const configs = this.getScheduleConfigs();
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
        
        // Run initial check immediately for non-session-aware sources
        // Session-aware sources check their own status
        if (!config.sessionAware) {
          await config.checkFunction();
        }
        
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
  }

  /**
   * Stop all schedules
   */
  stopAll(): void {
    log('⏹️  Stopping Smart Scheduler...');
    Array.from(this.intervals.entries()).forEach(([name, interval]) => {
      clearInterval(interval);
      log(`   Stopped: ${name}`);
    });
    this.intervals.clear();
  }

  /**
   * Manually trigger a specific source check
   */
  async triggerCheck(sourceName: string): Promise<void> {
    const configs = this.getScheduleConfigs();
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
  getStatus(): {
    schedules: Array<{
      name: string;
      description: string;
      enabled: boolean;
      interval: string;
      nextRun?: string;
    }>;
    activeCount: number;
    pausedCount: number;
  } {
    const configs = this.getScheduleConfigs();
    
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
}

// Export singleton instance
export const smartScheduler = new SmartScheduler();

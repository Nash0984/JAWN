import { embeddingCache } from './embeddingCache';
import { ragCache } from './ragCache';
import { documentAnalysisCache } from './documentAnalysisCache';
import { policyEngineCache } from './policyEngineCache';
import { cacheService } from './cacheService';
import { 
  InvalidationTrigger, 
  CacheLayer, 
  InvalidationRule,
  getInvalidationRule,
  getAffectedCaches,
  getCacheDependencies,
  isTaxYearAffected,
  TAX_YEAR_AFFECTED_PROGRAMS,
  INVALIDATION_RULES
} from './cacheInvalidationRules';
import { db } from '../db';
import { monitoringMetrics } from '@shared/schema';
import cron from 'node:timers/promises';

/**
 * Unified Cache Orchestrator
 * 
 * Provides centralized cache management with smart invalidation across all cache layers.
 * Coordinates L1 (NodeCache) operations and prepares for L2 (Redis) and L3 (DB) integration.
 */

export interface CacheHealthReport {
  status: 'healthy' | 'degraded' | 'critical';
  layers: {
    L1: {
      status: 'healthy' | 'degraded' | 'critical';
      caches: Record<string, CacheLayerHealth>;
    };
    L2?: {
      status: 'not_implemented' | 'healthy' | 'degraded' | 'critical';
      details?: string;
    };
    L3?: {
      status: 'not_implemented' | 'healthy' | 'degraded' | 'critical';
      details?: string;
    };
  };
  lastInvalidation?: {
    trigger: InvalidationTrigger;
    timestamp: Date;
    affectedCaches: CacheLayer[];
  };
  taxYearRollover?: {
    lastCheck: Date;
    nextRollover: Date;
    currentTaxYear: number;
  };
}

export interface CacheLayerHealth {
  name: string;
  hitRate: string;
  size: number;
  maxSize: number;
  ttl: string;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface InvalidationEvent {
  trigger: InvalidationTrigger;
  affectedCaches: CacheLayer[];
  programCodes?: string[];
  metadata?: Record<string, any>;
  timestamp: Date;
  tenantId?: string;
}

class CacheOrchestratorService {
  private static instance: CacheOrchestratorService;
  private lastInvalidation?: InvalidationEvent;
  private currentTaxYear: number;
  private taxYearCheckInterval?: NodeJS.Timeout;

  private constructor() {
    this.currentTaxYear = new Date().getFullYear();
    this.initializeTaxYearRolloverDetection();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CacheOrchestratorService {
    if (!CacheOrchestratorService.instance) {
      CacheOrchestratorService.instance = new CacheOrchestratorService();
    }
    return CacheOrchestratorService.instance;
  }

  /**
   * Initialize tax year rollover detection
   * Checks every hour for January 1st rollover
   */
  private initializeTaxYearRolloverDetection(): void {
    // Check immediately on startup
    this.checkTaxYearRollover();

    // Then check every hour
    this.taxYearCheckInterval = setInterval(() => {
      this.checkTaxYearRollover();
    }, 60 * 60 * 1000); // Every hour

    console.log('📅 Tax year rollover detection initialized');
  }

  /**
   * Check for tax year rollover and auto-clear caches on January 1
   */
  private async checkTaxYearRollover(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();

    // Detect if we've rolled over to a new year
    if (year > this.currentTaxYear) {
      console.log(`📅 TAX YEAR ROLLOVER DETECTED: ${this.currentTaxYear} → ${year}`);
      
      try {
        await this.invalidateOnTaxYearChange(year);
        this.currentTaxYear = year;
        
        console.log(`✅ Tax year rollover complete. Now using tax year ${year}`);
      } catch (error) {
        console.error('❌ Error during tax year rollover:', error);
        
        // Log critical error to monitoring (with safe error handling)
        try {
          await this.logToMonitoring({
            metricType: 'cache_invalidation_error',
            metricValue: 1,
            metadata: {
              trigger: 'tax_year_rollover',
              error: error instanceof Error ? error.message : 'Unknown error',
              year
            }
          });
        } catch (logError) {
          console.error('❌ Failed to log tax year rollover error:', logError);
          // Swallow this error to prevent interval crash during DB outages
        }
      }
    }
  }

  /**
   * Invalidate caches based on a rule trigger
   */
  async invalidateByRule(trigger: InvalidationTrigger, metadata?: Record<string, any>): Promise<void> {
    const rule = getInvalidationRule(trigger);
    const affectedCaches = rule.affectedCaches;

    console.log(`🔄 Invalidating caches for trigger: ${trigger}`);
    console.log(`   Affected caches: ${affectedCaches.join(', ')}`);
    console.log(`   Severity: ${rule.severity}`);
    console.log(`   Reason: ${rule.reason}`);

    const event: InvalidationEvent = {
      trigger,
      affectedCaches,
      programCodes: rule.programCodes,
      metadata,
      timestamp: new Date()
    };

    // Perform invalidation
    await this.invalidateCacheLayers(affectedCaches, rule.programCodes);

    // Store last invalidation
    this.lastInvalidation = event;

    // Log to monitoring_metrics
    await this.logInvalidationEvent(event, rule.severity);

    // Notify admins if required
    if (rule.notifyAdmins) {
      await this.notifyAdmins(event, rule);
    }

    console.log(`✅ Cache invalidation complete for: ${trigger}`);
  }

  /**
   * Invalidate caches on tax year change (January 1)
   */
  async invalidateOnTaxYearChange(newYear: number): Promise<void> {
    console.log(`📅 Clearing caches for tax year rollover: ${newYear}`);

    const rule = getInvalidationRule('tax_year_rollover');
    const affectedCaches = rule.affectedCaches;

    // Clear all tax-related caches
    await this.invalidateCacheLayers(affectedCaches, TAX_YEAR_AFFECTED_PROGRAMS);

    const event: InvalidationEvent = {
      trigger: 'tax_year_rollover',
      affectedCaches,
      programCodes: TAX_YEAR_AFFECTED_PROGRAMS,
      metadata: { newYear, previousYear: newYear - 1 },
      timestamp: new Date()
    };

    this.lastInvalidation = event;

    // Log critical tax year rollover event
    await this.logInvalidationEvent(event, 'critical');

    // Always notify admins for tax year rollover
    await this.notifyAdmins(event, rule);

    console.log(`✅ Tax year ${newYear} cache invalidation complete`);
  }

  /**
   * Invalidate caches on policy update for specific program
   */
  async invalidateOnPolicyUpdate(programCode: string, changeType?: string): Promise<void> {
    console.log(`📋 Invalidating caches for policy update: ${programCode}`);

    const rule = getInvalidationRule('policy_change');
    const affectedCaches = rule.affectedCaches;

    // Clear caches for this specific program
    await this.invalidateCacheLayers(affectedCaches, [programCode]);

    const event: InvalidationEvent = {
      trigger: 'policy_change',
      affectedCaches,
      programCodes: [programCode],
      metadata: { changeType },
      timestamp: new Date()
    };

    this.lastInvalidation = event;

    // Log event
    await this.logInvalidationEvent(event, 'high');

    console.log(`✅ Policy update cache invalidation complete for: ${programCode}`);
  }

  /**
   * Invalidate caches when Maryland rules are updated
   */
  async invalidateOnMarylandRuleUpdate(programCode?: string): Promise<void> {
    console.log(`🏛️  Invalidating caches for Maryland rule update`);

    const rule = getInvalidationRule('maryland_rule_update');
    const affectedCaches = rule.affectedCaches;
    const programs = programCode ? [programCode] : rule.programCodes;

    await this.invalidateCacheLayers(affectedCaches, programs);

    const event: InvalidationEvent = {
      trigger: 'maryland_rule_update',
      affectedCaches,
      programCodes: programs,
      timestamp: new Date()
    };

    this.lastInvalidation = event;
    await this.logInvalidationEvent(event, 'critical');

    if (rule.notifyAdmins) {
      await this.notifyAdmins(event, rule);
    }

    console.log(`✅ Maryland rule update cache invalidation complete`);
  }

  /**
   * Invalidate caches when DHS forms are updated
   */
  async invalidateOnDhsFormUpdate(formNumber: string, formType?: string): Promise<void> {
    console.log(`📝 Invalidating caches for DHS form update: ${formNumber}`);

    const rule = getInvalidationRule('dhs_form_update');
    const affectedCaches = rule.affectedCaches;

    // For DHS forms, we only clear document analysis and RAG caches
    await this.invalidateCacheLayers(affectedCaches);

    const event: InvalidationEvent = {
      trigger: 'dhs_form_update',
      affectedCaches,
      metadata: { formNumber, formType },
      timestamp: new Date()
    };

    this.lastInvalidation = event;
    await this.logInvalidationEvent(event, 'medium');

    console.log(`✅ DHS form update cache invalidation complete`);
  }

  /**
   * Invalidate specific cache layers with optional program filtering
   */
  private async invalidateCacheLayers(layers: CacheLayer[], programCodes?: string[]): Promise<void> {
    for (const layer of layers) {
      switch (layer) {
        case 'embedding':
          embeddingCache.clear();
          console.log('  ✓ Cleared embedding cache');
          break;

        case 'rag':
          if (programCodes) {
            // Clear RAG cache for specific programs
            for (const programCode of programCodes) {
              ragCache.invalidateProgram(programCode);
            }
          } else {
            ragCache.clear();
          }
          console.log('  ✓ Cleared RAG cache');
          break;

        case 'document_analysis':
          documentAnalysisCache.clear();
          console.log('  ✓ Cleared document analysis cache');
          break;

        case 'policy_engine':
          policyEngineCache.clear();
          console.log('  ✓ Cleared PolicyEngine cache');
          break;

        case 'rules_engine':
          // Clear rules engine caches from cacheService
          if (programCodes) {
            for (const programCode of programCodes) {
              cacheService.invalidatePattern(`rules:${programCode}:`);
            }
          } else {
            cacheService.invalidatePattern('rules:');
          }
          console.log('  ✓ Cleared rules engine cache');
          break;

        case 'hybrid_calc':
          // Clear hybrid calculation caches
          if (programCodes) {
            for (const programCode of programCodes) {
              cacheService.invalidatePattern(`hybrid:${programCode}:`);
            }
          } else {
            cacheService.invalidatePattern('hybrid:');
          }
          console.log('  ✓ Cleared hybrid calculation cache');
          break;

        case 'benefit_summary':
          // Clear benefit summary caches
          cacheService.invalidatePattern('pe:summary:');
          console.log('  ✓ Cleared benefit summary cache');
          break;

        case 'manual_sections':
          // Clear manual section caches
          cacheService.invalidatePattern('manual_section');
          console.log('  ✓ Cleared manual sections cache');
          break;

        case 'all':
          // Clear everything
          embeddingCache.clear();
          ragCache.clear();
          documentAnalysisCache.clear();
          policyEngineCache.clear();
          cacheService.flush();
          console.log('  ✓ Cleared ALL caches');
          break;
      }
    }
  }

  /**
   * Get comprehensive cache health report
   */
  async getCacheHealth(): Promise<CacheHealthReport> {
    const embeddingStats = embeddingCache.getStats();
    const ragStats = ragCache.getStats();
    const docStats = documentAnalysisCache.getStats();
    const policyEngineStats = policyEngineCache.getStats();

    // Calculate overall L1 status
    const l1Caches: Record<string, CacheLayerHealth> = {
      embedding: {
        name: 'Embedding Cache',
        hitRate: embeddingStats.hitRate,
        size: embeddingStats.cacheSize,
        maxSize: embeddingStats.maxKeys,
        ttl: '24 hours',
        status: this.calculateCacheStatus(embeddingStats.hitRate)
      },
      rag: {
        name: 'RAG Query Cache',
        hitRate: ragStats.hitRate,
        size: ragStats.cacheSize,
        maxSize: ragStats.maxKeys,
        ttl: ragStats.ttl,
        status: this.calculateCacheStatus(ragStats.hitRate)
      },
      documentAnalysis: {
        name: 'Document Analysis Cache',
        hitRate: docStats.hitRate,
        size: docStats.cacheSize,
        maxSize: docStats.maxKeys,
        ttl: docStats.ttl,
        status: this.calculateCacheStatus(docStats.hitRate)
      },
      policyEngine: {
        name: 'PolicyEngine Cache',
        hitRate: policyEngineStats.hitRate,
        size: policyEngineStats.cacheSize,
        maxSize: policyEngineStats.maxKeys,
        ttl: policyEngineStats.ttl,
        status: this.calculateCacheStatus(policyEngineStats.hitRate)
      }
    };

    const l1Status = this.calculateOverallL1Status(l1Caches);

    // Calculate next tax year rollover
    const now = new Date();
    const nextYear = now.getFullYear() + 1;
    const nextRollover = new Date(nextYear, 0, 1); // January 1

    return {
      status: l1Status,
      layers: {
        L1: {
          status: l1Status,
          caches: l1Caches
        },
        L2: {
          status: 'not_implemented',
          details: 'Redis integration prepared but not implemented. Would provide cross-instance cache sharing.'
        },
        L3: {
          status: 'not_implemented',
          details: 'Database materialized views prepared but not implemented. Would provide pre-computed aggregations.'
        }
      },
      lastInvalidation: this.lastInvalidation ? {
        trigger: this.lastInvalidation.trigger,
        timestamp: this.lastInvalidation.timestamp,
        affectedCaches: this.lastInvalidation.affectedCaches
      } : undefined,
      taxYearRollover: {
        lastCheck: new Date(),
        nextRollover,
        currentTaxYear: this.currentTaxYear
      }
    };
  }

  /**
   * Calculate cache status based on hit rate
   */
  private calculateCacheStatus(hitRate: string): 'healthy' | 'degraded' | 'critical' {
    const rate = parseFloat(hitRate.replace('%', ''));
    
    if (rate >= 50) return 'healthy';
    if (rate >= 30) return 'degraded';
    return 'critical';
  }

  /**
   * Calculate overall L1 status
   */
  private calculateOverallL1Status(caches: Record<string, CacheLayerHealth>): 'healthy' | 'degraded' | 'critical' {
    const statuses = Object.values(caches).map(c => c.status);
    
    if (statuses.some(s => s === 'critical')) return 'critical';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  }

  /**
   * Log invalidation event to monitoring_metrics
   */
  private async logInvalidationEvent(event: InvalidationEvent, severity: string): Promise<void> {
    try {
      await db.insert(monitoringMetrics).values({
        metricType: 'cache_invalidation',
        metricValue: event.affectedCaches.length,
        metadata: {
          trigger: event.trigger,
          affectedCaches: event.affectedCaches,
          programCodes: event.programCodes,
          severity,
          ...event.metadata
        },
        tenantId: event.tenantId
      });
    } catch (error) {
      console.error('Failed to log invalidation event:', error);
    }
  }

  /**
   * Log generic monitoring metric
   */
  private async logToMonitoring(data: {
    metricType: string;
    metricValue: number;
    metadata?: Record<string, any>;
    tenantId?: string;
  }): Promise<void> {
    try {
      await db.insert(monitoringMetrics).values(data);
    } catch (error) {
      console.error('Failed to log to monitoring:', error);
    }
  }

  /**
   * Notify administrators of cache invalidation
   */
  private async notifyAdmins(event: InvalidationEvent, rule: InvalidationRule): Promise<void> {
    // Log admin notification
    console.log(`📧 ADMIN NOTIFICATION: ${rule.trigger}`);
    console.log(`   Severity: ${rule.severity}`);
    console.log(`   Reason: ${rule.reason}`);
    console.log(`   Affected caches: ${event.affectedCaches.join(', ')}`);
    
    if (event.programCodes) {
      console.log(`   Affected programs: ${event.programCodes.join(', ')}`);
    }

    // TODO: Integrate with notification service when available
    // await notificationService.notifyAdmins({
    //   type: 'cache_invalidation',
    //   severity: rule.severity,
    //   message: rule.reason,
    //   metadata: event
    // });
  }

  /**
   * Get all invalidation rules for documentation
   */
  getAllRules(): Record<InvalidationTrigger, InvalidationRule> {
    return INVALIDATION_RULES;
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.taxYearCheckInterval) {
      clearInterval(this.taxYearCheckInterval);
    }
    console.log('📦 Cache Orchestrator shutdown complete');
  }
}

// Export singleton instance
export const cacheOrchestrator = CacheOrchestratorService.getInstance();

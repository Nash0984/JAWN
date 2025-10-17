import { embeddingCache } from './embeddingCache';
import { ragCache } from './ragCache';
import { documentAnalysisCache } from './documentAnalysisCache';
import { policyEngineCache } from './policyEngineCache';
import { cacheService } from './cacheService';

/**
 * Cache Metrics Aggregation Service
 * 
 * Centralizes performance monitoring across all caching layers.
 * Provides unified view of cost savings and cache efficiency.
 * Now includes hierarchical L1/L2/L3 reporting structure.
 */

interface AggregatedMetrics {
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  overallHitRate: string;
  estimatedCostSavings: {
    embedding: string;
    rag: string;
    documentAnalysis: string;
    total: string;
  };
  estimatedTimeSavings: {
    policyEngine: string;
  };
  cacheStats: {
    embedding: ReturnType<typeof embeddingCache.getStats>;
    rag: ReturnType<typeof ragCache.getStats>;
    documentAnalysis: ReturnType<typeof documentAnalysisCache.getStats>;
    policyEngine: ReturnType<typeof policyEngineCache.getStats>;
  };
}

interface HierarchicalMetrics {
  layers: {
    L1: {
      type: 'NodeCache (In-Memory)';
      status: 'active';
      caches: {
        embedding: ReturnType<typeof embeddingCache.getStats>;
        rag: ReturnType<typeof ragCache.getStats>;
        documentAnalysis: ReturnType<typeof documentAnalysisCache.getStats>;
        policyEngine: ReturnType<typeof policyEngineCache.getStats>;
        rulesEngine: {
          description: 'Rules engine calculation cache';
          ttl: '5 minutes';
          keys: number;
        };
      };
      totalHits: number;
      totalMisses: number;
      overallHitRate: string;
      estimatedCostSavings: string;
    };
    L2: {
      type: 'Redis (Distributed Cache)';
      status: 'not_implemented';
      description: string;
      benefits: string[];
      candidates: string[];
    };
    L3: {
      type: 'PostgreSQL (Materialized Views)';
      status: 'not_implemented';
      description: string;
      benefits: string[];
      candidates: string[];
    };
  };
  recommendations: string[];
}

class CacheMetricsService {
  /**
   * Get aggregated metrics across all caches
   */
  getAggregatedMetrics(): AggregatedMetrics {
    const embeddingStats = embeddingCache.getStats();
    const ragStats = ragCache.getStats();
    const docStats = documentAnalysisCache.getStats();
    const policyEngineStats = policyEngineCache.getStats();
    
    // Calculate totals
    const totalHits = 
      embeddingStats.hits + 
      ragStats.hits + 
      docStats.hits + 
      policyEngineStats.hits;
    
    const totalMisses = 
      embeddingStats.misses + 
      ragStats.misses + 
      docStats.misses + 
      policyEngineStats.misses;
    
    const totalRequests = totalHits + totalMisses;
    const overallHitRate = totalRequests > 0 
      ? ((totalHits / totalRequests) * 100).toFixed(2) + '%'
      : '0%';
    
    // Extract cost savings
    const embeddingCost = parseFloat(embeddingStats.estimatedCostSavings.replace('$', ''));
    const ragCost = parseFloat(ragStats.estimatedCostSavings.replace('$', ''));
    const docCost = parseFloat(docStats.estimatedCostSavings.replace('$', ''));
    const totalCost = embeddingCost + ragCost + docCost;
    
    return {
      totalHits,
      totalMisses,
      totalRequests,
      overallHitRate,
      estimatedCostSavings: {
        embedding: embeddingStats.estimatedCostSavings,
        rag: ragStats.estimatedCostSavings,
        documentAnalysis: docStats.estimatedCostSavings,
        total: `$${totalCost.toFixed(4)}`
      },
      estimatedTimeSavings: {
        policyEngine: policyEngineStats.estimatedTimeSavings
      },
      cacheStats: {
        embedding: embeddingStats,
        rag: ragStats,
        documentAnalysis: docStats,
        policyEngine: policyEngineStats
      }
    };
  }
  
  /**
   * Get detailed cost savings report
   */
  getCostSavingsReport() {
    const metrics = this.getAggregatedMetrics();
    
    // Estimate total API cost reduction (comparing to no caching)
    const totalSavings = parseFloat(metrics.estimatedCostSavings.total.replace('$', ''));
    
    // Estimate what costs would have been without caching (inverse of hit rate)
    const hitRate = parseFloat(metrics.overallHitRate.replace('%', '')) / 100;
    const estimatedWithoutCaching = hitRate > 0 ? totalSavings / hitRate : 0;
    const estimatedCurrentCost = estimatedWithoutCaching - totalSavings;
    
    return {
      summary: {
        totalRequests: metrics.totalRequests,
        cacheHitRate: metrics.overallHitRate,
        estimatedSavings: metrics.estimatedCostSavings.total,
        estimatedCurrentCost: `$${estimatedCurrentCost.toFixed(4)}`,
        estimatedWithoutCaching: `$${estimatedWithoutCaching.toFixed(4)}`,
        reductionPercentage: hitRate > 0 ? `${(hitRate * 100).toFixed(1)}%` : '0%'
      },
      breakdown: {
        geminiEmbeddings: {
          hits: metrics.cacheStats.embedding.hits,
          savings: metrics.estimatedCostSavings.embedding,
          hitRate: metrics.cacheStats.embedding.hitRate
        },
        ragQueries: {
          hits: metrics.cacheStats.rag.hits,
          savings: metrics.estimatedCostSavings.rag,
          hitRate: metrics.cacheStats.rag.hitRate
        },
        documentAnalysis: {
          hits: metrics.cacheStats.documentAnalysis.hits,
          savings: metrics.estimatedCostSavings.documentAnalysis,
          hitRate: metrics.cacheStats.documentAnalysis.hitRate
        },
        policyEngine: {
          hits: metrics.cacheStats.policyEngine.hits,
          timeSaved: metrics.estimatedTimeSavings.policyEngine,
          hitRate: metrics.cacheStats.policyEngine.hitRate
        }
      },
      projections: {
        daily: `$${(totalSavings * 24).toFixed(4)}`,
        monthly: `$${(totalSavings * 24 * 30).toFixed(4)}`,
        yearly: `$${(totalSavings * 24 * 365).toFixed(4)}`
      }
    };
  }
  
  /**
   * Clear specific cache type
   */
  clearCache(type: 'embedding' | 'rag' | 'documentAnalysis' | 'policyEngine' | 'all') {
    switch (type) {
      case 'embedding':
        embeddingCache.clear();
        break;
      case 'rag':
        ragCache.clear();
        break;
      case 'documentAnalysis':
        documentAnalysisCache.clear();
        break;
      case 'policyEngine':
        policyEngineCache.clear();
        break;
      case 'all':
        embeddingCache.clear();
        ragCache.clear();
        documentAnalysisCache.clear();
        policyEngineCache.clear();
        console.log('📦 All caches cleared');
        break;
    }
  }
  
  /**
   * Reset all metrics (for testing)
   */
  resetAllMetrics() {
    embeddingCache.resetMetrics();
    ragCache.resetMetrics();
    documentAnalysisCache.resetMetrics();
    policyEngineCache.resetMetrics();
    console.log('📊 All cache metrics reset');
  }

  /**
   * Get hierarchical cache metrics with L1/L2/L3 structure
   */
  getHierarchicalMetrics(): HierarchicalMetrics {
    const metrics = this.getAggregatedMetrics();
    const rulesEngineKeys = cacheService.keys().filter(k => 
      k.includes('rules:') || k.includes('pe:') || k.includes('hybrid:')
    );

    return {
      layers: {
        L1: {
          type: 'NodeCache (In-Memory)',
          status: 'active',
          caches: {
            embedding: metrics.cacheStats.embedding,
            rag: metrics.cacheStats.rag,
            documentAnalysis: metrics.cacheStats.documentAnalysis,
            policyEngine: metrics.cacheStats.policyEngine,
            rulesEngine: {
              description: 'Rules engine calculation cache',
              ttl: '5 minutes',
              keys: rulesEngineKeys.length
            }
          },
          totalHits: metrics.totalHits,
          totalMisses: metrics.totalMisses,
          overallHitRate: metrics.overallHitRate,
          estimatedCostSavings: metrics.estimatedCostSavings.total
        },
        L2: {
          type: 'Redis (Distributed Cache)',
          status: 'not_implemented',
          description: 'Redis would provide cross-instance cache sharing for horizontal scaling',
          benefits: [
            'Cache sharing across multiple application instances',
            'Persistent cache that survives application restarts',
            'TTL-based expiration with atomic operations',
            'Support for pub/sub invalidation events'
          ],
          candidates: [
            'PolicyEngine calculations (shared across navigators)',
            'RAG query results (shared across sessions)',
            'Benefit summary cache (high-value, reusable)',
            'Income limit lookups (frequently accessed)'
          ]
        },
        L3: {
          type: 'PostgreSQL (Materialized Views)',
          status: 'not_implemented',
          description: 'Database materialized views for pre-computed aggregations and analytics',
          benefits: [
            'Pre-computed statistics and aggregations',
            'Reduced query complexity for reporting',
            'Automatic refresh on schedule or trigger',
            'SQL-based query optimization'
          ],
          candidates: [
            'County-level benefit statistics (aggregated SNAP/TANF/Medicaid data)',
            'Navigator performance metrics (case counts, success rates)',
            'Program enrollment trends (monthly/yearly rollups)',
            'Tax preparation statistics (VITA volume, EITC claims)'
          ]
        }
      },
      recommendations: [
        metrics.totalRequests > 10000 
          ? 'Consider implementing L2 (Redis) for cross-instance cache sharing' 
          : 'L1 cache sufficient for current load',
        parseFloat(metrics.overallHitRate) < 40 
          ? 'Low hit rate detected - review cache TTL and invalidation patterns' 
          : 'Cache hit rate is healthy',
        'Implement L3 materialized views for county analytics and reporting dashboards',
        'Monitor cache size - consider implementing cache eviction policies if memory usage grows'
      ]
    };
  }

  /**
   * Get cache layer recommendations based on usage patterns
   */
  getCacheLayerRecommendations(): string[] {
    const metrics = this.getAggregatedMetrics();
    const recommendations: string[] = [];

    const hitRate = parseFloat(metrics.overallHitRate);
    
    if (hitRate < 30) {
      recommendations.push('⚠️ Low cache hit rate - consider increasing TTL or reviewing invalidation patterns');
    }

    if (metrics.totalRequests > 50000) {
      recommendations.push('📈 High request volume - consider implementing L2 (Redis) for better scalability');
    }

    const embeddingSize = metrics.cacheStats.embedding.cacheSize;
    if (embeddingSize > 8000) {
      recommendations.push('💾 Embedding cache approaching limit - consider implementing LRU eviction');
    }

    const ragSize = metrics.cacheStats.rag.cacheSize;
    if (ragSize > 4000) {
      recommendations.push('💾 RAG cache approaching limit - consider L2 (Redis) for larger capacity');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All cache layers operating within healthy parameters');
    }

    return recommendations;
  }
}

export const cacheMetrics = new CacheMetricsService();

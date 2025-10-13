import { embeddingCache } from './embeddingCache';
import { ragCache } from './ragCache';
import { documentAnalysisCache } from './documentAnalysisCache';
import { policyEngineCache } from './policyEngineCache';

/**
 * Cache Metrics Aggregation Service
 * 
 * Centralizes performance monitoring across all caching layers.
 * Provides unified view of cost savings and cache efficiency.
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
}

export const cacheMetrics = new CacheMetricsService();

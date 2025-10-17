# AI Orchestrator - Usage Guide

## Overview

The AI Orchestrator is a unified service that consolidates all Gemini API operations into a single, efficient layer with:

- **Singleton Pattern**: Single Gemini client instance across the application
- **Smart Model Routing**: Automatically selects the best model for each task
- **Rate Limiting**: Respects API limits with priority-based request queueing
- **Cost Tracking**: Monitors API usage and costs in monitoring_metrics table
- **Error Handling**: Exponential backoff retry logic with PII-masked error logging
- **Embedding Cache**: Reuses existing cache for 60-80% cost reduction

## Architecture

### Model Selection

The orchestrator automatically routes requests to the optimal model:

- **Vision Tasks** → `gemini-2.0-flash` (fast image analysis)
- **Code Execution** → `gemini-2.0-flash-thinking` (reasoning + calculations)
- **Text/RAG** → `gemini-2.0-flash` (general chat and search)
- **Embeddings** → `text-embedding-004` (semantic search)

### Rate Limiting

- **Max Concurrent**: 5 requests
- **Rate Window**: 50 requests per minute (Gemini free tier)
- **Priority Levels**:
  - `critical` (100) - Tax filing, time-sensitive operations
  - `normal` (50) - Standard operations
  - `background` (10) - Batch processing, embeddings

### Cost Tracking

All API calls are tracked in the `monitoring_metrics` table with:
- Feature name (tax_extraction, policy_search, etc.)
- Model used
- Token count (estimated)
- Estimated cost

## Usage Examples

### 1. Text Generation

```typescript
import { aiOrchestrator } from '../services/aiOrchestrator';

// Simple text generation
const response = await aiOrchestrator.generateText(
  'Explain SNAP eligibility requirements',
  { 
    feature: 'policy_search',
    priority: 'normal'
  }
);

// Critical operation (tax filing)
const taxAdvice = await aiOrchestrator.generateText(
  'Calculate EITC for household of 3',
  { 
    feature: 'tax_calculations',
    priority: 'critical'
  }
);
```

### 2. Image Analysis

```typescript
// Analyze uploaded document
const extractedData = await aiOrchestrator.analyzeImage(
  base64ImageData,
  'Extract W-2 form data from this image',
  { 
    feature: 'tax_extraction',
    priority: 'critical'
  }
);
```

### 3. Code Execution (NEW!)

```typescript
// Execute calculations with reasoning
const calculation = await aiOrchestrator.executeCode(
  'Calculate 15% EITC for family of 4 with $45,000 income',
  { 
    feature: 'tax_calculations',
    priority: 'critical'
  }
);

console.log(calculation.code);        // The code executed
console.log(calculation.result);      // Calculation result
console.log(calculation.explanation); // AI explanation
```

### 4. Embeddings (with Cache)

```typescript
// Generate embeddings - automatically cached
const embedding = await aiOrchestrator.generateEmbedding(
  'SNAP income eligibility rules'
);

// Second call hits cache (no API call!)
const cachedEmbedding = await aiOrchestrator.generateEmbedding(
  'SNAP income eligibility rules'
);
```

### 5. Cost Metrics

```typescript
// Get all-time metrics
const allMetrics = await aiOrchestrator.getCostMetrics();
console.log(`Total cost: $${allMetrics.estimatedCost.toFixed(6)}`);
console.log('By feature:', allMetrics.callsByFeature);
console.log('By model:', allMetrics.callsByModel);

// Get metrics for specific time range
const todayMetrics = await aiOrchestrator.getCostMetrics({
  start: new Date(new Date().setHours(0, 0, 0, 0)),
  end: new Date()
});
```

### 6. Monitoring

```typescript
// Check queue status
const status = aiOrchestrator.getQueueStatus();
console.log('Queue length:', status.queueLength);
console.log('Active requests:', status.activeRequests);
console.log('Can make request:', status.canMakeRequest);

// Check embedding cache stats
const cacheStats = aiOrchestrator.getEmbeddingCacheStats();
console.log('Cache hit rate:', cacheStats.hitRate);
console.log('Cost savings:', cacheStats.estimatedCostSavings);
```

## Migration from Existing Services

### Before (gemini.service.ts)
```typescript
import { generateTextWithGemini } from './gemini.service';

const result = await generateTextWithGemini(prompt);
```

### After (aiOrchestrator)
```typescript
import { aiOrchestrator } from './aiOrchestrator';

const result = await aiOrchestrator.generateText(prompt, {
  feature: 'policy_search',
  priority: 'normal'
});
```

### Benefits of Migration
- ✅ Unified rate limiting across all features
- ✅ Cost tracking per feature
- ✅ Priority-based queueing
- ✅ Exponential backoff retry logic
- ✅ PII-masked error logging

## Error Handling

The orchestrator automatically retries failed requests with exponential backoff:

```typescript
try {
  const result = await aiOrchestrator.generateText(prompt, {
    feature: 'my_feature'
  });
} catch (error) {
  // Error already logged with PII masking
  // Retry logic exhausted after 3 attempts
  // Fallback to cached result or default value
}
```

### Retryable Errors
- 429 (Rate limit exceeded)
- 503 (Service unavailable)
- RESOURCE_EXHAUSTED

### Retry Configuration
- Max retries: 3
- Base delay: 1 second
- Exponential backoff: 1s → 2s → 4s

## Cost Optimization

### Embedding Cache
- **Hit Rate**: 60-80% (based on typical usage)
- **Savings**: ~$0.000001 per cached embedding
- **TTL**: 24 hours
- **Max Keys**: 10,000 embeddings

### Model Pricing (per 1K tokens)
- `gemini-2.0-flash`: $0.000075 (input) / $0.0003 (output)
- `gemini-2.0-flash-thinking`: $0.000075 (input) / $0.0003 (output)
- `gemini-1.5-pro`: $0.00125 (input) / $0.005 (output)
- `text-embedding-004`: $0.00001 (input only)

## Best Practices

1. **Set Feature Names**: Always specify feature for cost tracking
   ```typescript
   { feature: 'tax_extraction' }
   ```

2. **Use Priority Levels**: Critical operations get processed first
   ```typescript
   { priority: 'critical' }  // Tax filing
   { priority: 'normal' }    // Standard ops
   { priority: 'background' } // Batch processing
   ```

3. **Monitor Costs**: Regularly check metrics
   ```typescript
   const metrics = await aiOrchestrator.getCostMetrics();
   ```

4. **Leverage Cache**: Reuse embeddings for identical text
   ```typescript
   const embedding = await aiOrchestrator.generateEmbedding(text);
   ```

5. **Handle Errors**: Implement fallbacks for failed requests
   ```typescript
   try {
     const result = await aiOrchestrator.generateText(prompt);
   } catch (error) {
     // Return cached or default value
   }
   ```

## Testing

Note: The test script requires a valid Gemini API key. Current quota limits may prevent execution.

```bash
# Run test (requires GOOGLE_API_KEY or GEMINI_API_KEY)
npm run tsx scripts/test-ai-orchestrator.ts
```

## Future Enhancements

- [ ] Response streaming for long-running requests
- [ ] Multi-model fallback (Gemini → OpenAI → Claude)
- [ ] Advanced caching strategies (response caching)
- [ ] Real-time cost alerts
- [ ] Per-user rate limiting
- [ ] Model performance benchmarking

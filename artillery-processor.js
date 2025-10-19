// Artillery processor for custom logic and metrics

module.exports = {
  // Before scenario hooks
  beforeScenario: beforeScenario,
  afterScenario: afterScenario,
  
  // Custom functions for scenarios
  generateTestData: generateTestData,
  validateResponse: validateResponse,
  extractCacheMetrics: extractCacheMetrics,
};

// Generate dynamic test data
function generateTestData(userContext, events, done) {
  // Add random data to context
  userContext.vars.randomIncome = Math.floor(Math.random() * 5000) + 1000;
  userContext.vars.randomHouseholdSize = Math.floor(Math.random() * 6) + 1;
  userContext.vars.timestamp = Date.now();
  
  // Random search terms
  const searchTerms = [
    'SNAP eligibility requirements',
    'Medicaid application process',
    'OHEP energy assistance',
    'tax credits Maryland',
    'food stamps Baltimore',
    'TCA TANF benefits',
    'emergency assistance',
    'rental assistance programs',
  ];
  userContext.vars.searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
  
  return done();
}

// Before scenario setup
function beforeScenario(userContext, events, done) {
  // Initialize metrics
  userContext.vars.startTime = Date.now();
  userContext.vars.requestCount = 0;
  userContext.vars.errorCount = 0;
  userContext.vars.cacheHits = 0;
  
  // Set user agent
  userContext.vars.userAgent = `Artillery/1.0 User-${userContext.vars.$uuid}`;
  
  return done();
}

// After scenario cleanup
function afterScenario(userContext, events, done) {
  const duration = Date.now() - userContext.vars.startTime;
  const successRate = ((userContext.vars.requestCount - userContext.vars.errorCount) / userContext.vars.requestCount) * 100;
  
  // Log scenario metrics
  console.log(`Scenario completed:
    Duration: ${duration}ms
    Requests: ${userContext.vars.requestCount}
    Errors: ${userContext.vars.errorCount}
    Success Rate: ${successRate.toFixed(2)}%
    Cache Hits: ${userContext.vars.cacheHits}`);
  
  return done();
}

// Validate API response
function validateResponse(requestParams, response, context, events, done) {
  context.vars.requestCount++;
  
  // Check for errors
  if (response.statusCode >= 400) {
    context.vars.errorCount++;
    console.error(`Error ${response.statusCode} on ${requestParams.url}`);
  }
  
  // Check if response was cached (very fast response)
  if (response.timings && response.timings.phases && response.timings.phases.total < 50) {
    context.vars.cacheHits++;
  }
  
  // Validate response structure
  try {
    if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
      const body = JSON.parse(response.body);
      
      // Check for expected fields based on endpoint
      if (requestParams.url.includes('/benefits/') && requestParams.url.includes('/eligibility')) {
        if (!body.hasOwnProperty('eligible')) {
          console.error('Missing eligibility field in response');
          context.vars.errorCount++;
        }
      }
      
      if (requestParams.url.includes('/search')) {
        if (!body.hasOwnProperty('results')) {
          console.error('Missing results field in search response');
          context.vars.errorCount++;
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse JSON response:', e.message);
    context.vars.errorCount++;
  }
  
  return done();
}

// Extract cache metrics from headers
function extractCacheMetrics(requestParams, response, context, events, done) {
  // Check for cache headers
  const cacheControl = response.headers['cache-control'];
  const xCacheStatus = response.headers['x-cache-status'];
  const xCacheHit = response.headers['x-cache-hit'];
  
  if (xCacheStatus === 'HIT' || xCacheHit === 'true') {
    context.vars.cacheHits++;
  }
  
  // Check for rate limit headers
  const rateLimitRemaining = response.headers['ratelimit-remaining'];
  if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
    console.warn(`Low rate limit remaining: ${rateLimitRemaining}`);
  }
  
  return done();
}
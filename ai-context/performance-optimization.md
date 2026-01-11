# Performance Optimization Guide

Comprehensive performance optimization strategies for the JAWN (Joint Access Welfare Network) multi-state benefits-tax platform.

## Table of Contents

1. [Database Optimization](#database-optimization)
2. [Caching Strategies](#caching-strategies)
3. [API Performance](#api-performance)
4. [Frontend Optimization](#frontend-optimization)
5. [Document Processing](#document-processing)
6. [AI/ML Model Optimization](#aiml-model-optimization)
7. [Monitoring & Profiling](#monitoring--profiling)

---

## Database Optimization

### Indexing Strategy

**Current Indexes (Verify in schema.ts):**

```typescript
// shared/schema.ts - Add indexes for frequently queried columns

// Documents table - most accessed by status, program, and user
export const documents = pgTable("documents", {
  // ... columns
}, (table) => ({
  statusIdx: index("documents_status_idx").on(table.status),
  programIdx: index("documents_program_idx").on(table.benefitProgramId),
  userIdx: index("documents_user_idx").on(table.uploadedBy),
  createdIdx: index("documents_created_idx").on(table.createdAt),
}));

// Document chunks - frequently searched by document
// Note: embeddings stored as JSON text, vector search handled in application layer
export const documentChunks = pgTable("document_chunks", {
  // ... columns
}, (table) => ({
  documentIdx: index("chunks_document_idx").on(table.documentId),
  pageIdx: index("chunks_page_idx").on(table.pageNumber),
}));

// Search queries - analytics and caching lookup
export const searchQueries = pgTable("search_queries", {
  // ... columns
}, (table) => ({
  userIdx: index("queries_user_idx").on(table.userId),
  programIdx: index("queries_program_idx").on(table.benefitProgramId),
  createdIdx: index("queries_created_idx").on(table.createdAt),
  // Composite index for cache lookups
  cacheIdx: index("queries_cache_idx").on(table.query, table.benefitProgramId),
}));

// Notifications - unread queries are frequent
export const notifications = pgTable("notifications", {
  // ... columns
}, (table) => ({
  userReadIdx: index("notifications_user_read_idx").on(table.userId, table.read),
  createdIdx: index("notifications_created_idx").on(table.createdAt),
}));

// Navigator sessions - status filtering
export const navigatorSessions = pgTable("navigator_sessions", {
  // ... columns
}, (table) => ({
  statusIdx: index("sessions_status_idx").on(table.status),
  navigatorIdx: index("sessions_navigator_idx").on(table.navigatorId),
  createdIdx: index("sessions_created_idx").on(table.createdAt),
}));

// Policy changes - impact level and status queries
export const policyChanges = pgTable("policy_changes", {
  // ... columns
}, (table) => ({
  statusIdx: index("changes_status_idx").on(table.status),
  impactIdx: index("changes_impact_idx").on(table.impactLevel),
  detectedIdx: index("changes_detected_idx").on(table.detectedAt),
}));
```

**Implementation Steps:**

1. Add indexes to schema.ts
2. Run `npm run db:push` to apply changes
3. Monitor query performance with `EXPLAIN ANALYZE`
4. Adjust based on actual query patterns

### Query Optimization

**Bad Pattern - N+1 Queries:**

```typescript
// ❌ Makes 1 + N queries
const sessions = await db.select().from(navigatorSessions);
for (const session of sessions) {
  const documents = await db.select().from(documents)
    .where(eq(documents.sessionId, session.id));
  session.documents = documents;
}
```

**Good Pattern - Single Query with Join:**

```typescript
// ✅ Single query with join
const sessions = await db.select({
  session: navigatorSessions,
  document: documents,
})
.from(navigatorSessions)
.leftJoin(documents, eq(documents.sessionId, navigatorSessions.id));

// Group results
const grouped = sessions.reduce((acc, row) => {
  if (!acc[row.session.id]) {
    acc[row.session.id] = { ...row.session, documents: [] };
  }
  if (row.document) {
    acc[row.session.id].documents.push(row.document);
  }
  return acc;
}, {} as Record<string, any>);
```

**Pagination Pattern:**

```typescript
// Always paginate large datasets
async function getDocumentsPaginated(
  limit: number = 50,
  offset: number = 0,
  filters?: { status?: string; programId?: string }
) {
  // Build filter conditions
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(documents.status, filters.status));
  }
  if (filters?.programId) {
    conditions.push(eq(documents.benefitProgramId, filters.programId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Build queries with same filters
  let itemsQuery = db.select().from(documents);
  let countQuery = db.select({ count: count() }).from(documents);
  
  if (whereClause) {
    itemsQuery = itemsQuery.where(whereClause);
    countQuery = countQuery.where(whereClause);
  }
  
  const [items, [{ count: totalCount }]] = await Promise.all([
    itemsQuery.limit(limit).offset(offset).orderBy(desc(documents.createdAt)),
    countQuery,
  ]);
  
  return {
    items,
    total: Number(totalCount),
    hasMore: offset + items.length < Number(totalCount),
  };
}
```

**Batch Operations:**

```typescript
// ❌ Multiple individual inserts
for (const chunk of chunks) {
  await db.insert(documentChunks).values(chunk);
}

// ✅ Single batch insert
await db.insert(documentChunks).values(chunks);

// ✅ Batch updates with transaction
await db.transaction(async (tx) => {
  await tx.update(documents)
    .set({ status: "reviewed" })
    .where(inArray(documents.id, documentIds));
  
  await tx.insert(auditLogs).values(
    documentIds.map(id => ({
      entityType: "document",
      entityId: id,
      action: "bulk_review",
      userId: reviewerId,
    }))
  );
});
```

---

## Caching Strategies

### Server-Side Cache Configuration

```typescript
// server/cache.ts - Enhanced caching with TTL and invalidation
import NodeCache from "node-cache";

// Different TTLs for different data types
export const caches = {
  // Static data - long TTL (1 hour)
  benefitPrograms: new NodeCache({ stdTTL: 3600, checkperiod: 600 }),
  documentTypes: new NodeCache({ stdTTL: 3600, checkperiod: 600 }),
  
  // Semi-static data - medium TTL (10 minutes)
  policyRules: new NodeCache({ stdTTL: 600, checkperiod: 120 }),
  manualSections: new NodeCache({ stdTTL: 600, checkperiod: 120 }),
  
  // Dynamic data - short TTL (2 minutes)
  searchResults: new NodeCache({ stdTTL: 120, checkperiod: 30 }),
  userSessions: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
  
  // Calculation cache - 5 minute TTL
  policyEngineResults: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
};

// Cache key generators
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {} as Record<string, any>);
  return `${prefix}:${JSON.stringify(sorted)}`;
}

// Invalidation helper
export function invalidateRelatedCaches(entityType: string, entityId?: string) {
  switch (entityType) {
    case "document":
      caches.searchResults.flushAll();
      break;
    case "rule":
      caches.policyRules.flushAll();
      caches.searchResults.flushAll();
      break;
    case "program":
      caches.benefitPrograms.flushAll();
      caches.policyRules.flushAll();
      break;
  }
}
```

### Cache Implementation Patterns

**Pattern 1: Read-Through Cache**

```typescript
// server/routes.ts
import { caches, generateCacheKey } from "./cache";

app.get("/api/benefit-programs", asyncHandler(async (req, res) => {
  const cacheKey = "benefit-programs:all";
  
  // Try cache first
  const cached = caches.benefitPrograms.get(cacheKey);
  if (cached) {
    return res.json({ programs: cached, cached: true });
  }
  
  // Cache miss - fetch from DB
  const programs = await storage.getBenefitPrograms();
  
  // Store in cache
  caches.benefitPrograms.set(cacheKey, programs);
  
  res.json({ programs, cached: false });
}));
```

**Pattern 2: Cache-Aside with Invalidation**

```typescript
app.post("/api/rules/income-limits", asyncHandler(async (req, res) => {
  const data = insertIncomeLimitSchema.parse(req.body);
  
  // Create rule
  const rule = await storage.createIncomeLimit(data);
  
  // Invalidate related caches
  invalidateRelatedCaches("rule");
  
  res.status(201).json({ rule });
}));
```

**Pattern 3: Computed Cache (Expensive Operations)**

```typescript
app.get("/api/ai-monitoring/query-analytics", asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey("analytics:queries", {
    timeRange: req.query.timeRange || "24h",
  });
  
  const cached = caches.searchResults.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  // Expensive aggregation query
  const analytics = await db.select({
    hour: sql`date_trunc('hour', created_at)`,
    count: count(),
    avgResponseTime: avg(searchQueries.responseTime),
  })
  .from(searchQueries)
  .where(gte(searchQueries.createdAt, sql`NOW() - INTERVAL '24 hours'`))
  .groupBy(sql`date_trunc('hour', created_at)`);
  
  caches.searchResults.set(cacheKey, analytics);
  
  res.json(analytics);
}));
```

### Client-Side Caching (TanStack Query)

```typescript
// client/src/lib/queryClient.ts - Optimized query defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Per-query configuration
const { data } = useQuery({
  queryKey: ['/api/benefit-programs'],
  staleTime: 30 * 60 * 1000, // 30 minutes for static data
  gcTime: 60 * 60 * 1000, // 1 hour
});

const { data: liveData } = useQuery({
  queryKey: ['/api/notifications/unread-count'],
  staleTime: 0, // Always fresh
  refetchInterval: 10000, // Poll every 10s
});
```

---

## API Performance

### Rate Limiting

```typescript
// server/routes.ts - Tiered rate limiting
import rateLimit from "express-rate-limit";

// Public endpoints - strict limits
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests from this IP",
});

// Authenticated users - relaxed limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: (req) => !req.user, // Only apply to authenticated users
});

// AI endpoints - strict limits (expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI calls per minute
  message: "AI rate limit exceeded. Please try again later.",
});

app.use("/api/public/*", publicLimiter);
app.use("/api/*", authLimiter);
app.use("/api/chat/*", aiLimiter);
app.use("/api/search", aiLimiter);
app.use("/api/policyengine/*", aiLimiter);
```

### Response Compression

```typescript
// server/index.ts
import compression from "compression";

app.use(compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
```

### Request Batching

```typescript
// client/src/lib/batchRequest.ts
class RequestBatcher {
  private queue: Array<{ url: string; resolve: Function }> = [];
  private timeout: NodeJS.Timeout | null = null;
  
  batch(url: string): Promise<any> {
    return new Promise((resolve) => {
      this.queue.push({ url, resolve });
      
      if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), 50); // 50ms batch window
      }
    });
  }
  
  private async flush() {
    const requests = [...this.queue];
    this.queue = [];
    this.timeout = null;
    
    // Group by base endpoint
    const grouped = requests.reduce((acc, req) => {
      const base = req.url.split('?')[0];
      if (!acc[base]) acc[base] = [];
      acc[base].push(req);
      return acc;
    }, {} as Record<string, typeof requests>);
    
    // Batch fetch
    await Promise.all(
      Object.entries(grouped).map(async ([base, reqs]) => {
        const ids = reqs.map(r => new URL(r.url).searchParams.get('id')).filter(Boolean);
        const response = await fetch(`${base}/batch?ids=${ids.join(',')}`);
        const data = await response.json();
        
        reqs.forEach((req, i) => req.resolve(data[i]));
      })
    );
  }
}

export const batcher = new RequestBatcher();
```

---

## Frontend Optimization

### Code Splitting

```typescript
// client/src/App.tsx - Lazy load routes
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const ScenarioWorkspace = lazy(() => import("@/pages/ScenarioWorkspace"));
const IntakePage = lazy(() => import("@/pages/IntakePage"));

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/scenarios" component={ScenarioWorkspace} />
        <Route path="/intake" component={IntakePage} />
      </Switch>
    </Suspense>
  );
}
```

### Component Optimization

```typescript
// client/src/components/DocumentList.tsx
import { memo } from "react";

// Memoize expensive components
export const DocumentCard = memo(({ document }: { document: Document }) => {
  return (
    <Card>
      <CardHeader>{document.filename}</CardHeader>
      <CardContent>{document.status}</CardContent>
    </Card>
  );
}, (prev, next) => {
  // Custom comparison - only re-render if status changes
  return prev.document.status === next.document.status;
});

// Virtual scrolling for long lists
import { useVirtualizer } from "@tanstack/react-virtual";

export function DocumentList({ documents }: { documents: Document[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated item height
    overscan: 5, // Render 5 extra items
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <DocumentCard document={documents[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Debouncing & Throttling

```typescript
// client/src/components/SearchBar.tsx
import { useMemo } from "react";
import debounce from "lodash/debounce";

export function SearchBar() {
  const [query, setQuery] = useState("");
  
  // Debounce search API calls
  const debouncedSearch = useMemo(
    () => debounce(async (searchTerm: string) => {
      if (searchTerm.length < 3) return;
      
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchTerm }),
      });
      
      const results = await response.json();
      setResults(results);
    }, 500), // Wait 500ms after user stops typing
    []
  );
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };
  
  useEffect(() => {
    return () => debouncedSearch.cancel(); // Cleanup
  }, [debouncedSearch]);
  
  return <Input value={query} onChange={handleChange} />;
}
```

### Image Optimization

```typescript
// Use next-gen formats and lazy loading
<img
  src="/images/hero.webp"
  alt="Maryland Benefits"
  loading="lazy"
  decoding="async"
  width={800}
  height={600}
  className="w-full h-auto"
/>

// Responsive images
<picture>
  <source media="(min-width: 1024px)" srcSet="/images/hero-large.webp" />
  <source media="(min-width: 640px)" srcSet="/images/hero-medium.webp" />
  <img src="/images/hero-small.webp" alt="Hero" />
</picture>
```

---

## Document Processing

### Parallel Processing

```typescript
// server/services/documentProcessor.ts
export async function processDocumentBatch(documentIds: string[]) {
  // Process in parallel batches of 5
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < documentIds.length; i += batchSize) {
    const batch = documentIds.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          return await processDocument(id);
        } catch (error) {
          console.error(`Failed to process document ${id}:`, error);
          return { id, error: error.message };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
}
```

### Chunking Strategy

```typescript
// server/services/semanticChunking.ts
export async function optimizedSemanticChunking(text: string) {
  const MAX_CHUNK_SIZE = 500; // tokens
  const MIN_CHUNK_SIZE = 100;
  const OVERLAP = 50; // tokens overlap between chunks
  
  // Split by semantic boundaries (paragraphs, sections)
  const sections = text.split(/\n\n+/);
  const chunks = [];
  
  let currentChunk = "";
  let currentTokens = 0;
  
  for (const section of sections) {
    const sectionTokens = estimateTokens(section);
    
    if (currentTokens + sectionTokens > MAX_CHUNK_SIZE && currentTokens >= MIN_CHUNK_SIZE) {
      // Finalize current chunk
      chunks.push({
        text: currentChunk,
        tokens: currentTokens,
      });
      
      // Start new chunk with overlap
      const overlapText = getLastNTokens(currentChunk, OVERLAP);
      currentChunk = overlapText + "\n\n" + section;
      currentTokens = OVERLAP + sectionTokens;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + section;
      currentTokens += sectionTokens;
    }
  }
  
  if (currentChunk) {
    chunks.push({ text: currentChunk, tokens: currentTokens });
  }
  
  return chunks;
}
```

### Embedding Batch Processing

```typescript
// server/services/geminiService.ts
export async function createEmbeddingsBatch(texts: string[]) {
  const BATCH_SIZE = 100; // Gemini API batch limit
  const embeddings = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await embeddingModel.batchEmbedContents({
      requests: batch.map(text => ({
        content: { parts: [{ text }] },
      })),
    });
    
    embeddings.push(...response.embeddings.map(e => e.values));
  }
  
  return embeddings;
}
```

---

## AI/ML Model Optimization

### Gemini API Optimization

```typescript
// server/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/genai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Reuse model instances
const models = {
  flash: genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
    },
  }),
  
  flashThinking: genAI.getGenerativeModel({
    model: "gemini-2.0-flash-thinking-exp-01-21",
    generationConfig: {
      temperature: 1.0,
      maxOutputTokens: 8192,
    },
  }),
};

// Streaming for long responses
export async function streamGeminiResponse(prompt: string) {
  const result = await models.flash.generateContentStream(prompt);
  
  let fullText = "";
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    // Stream to client via SSE or WebSocket
  }
  
  return fullText;
}

// Caching prompts (Gemini context caching)
export async function createCachedPrompt(systemPrompt: string) {
  const cachedContent = await genAI.cacheContent({
    model: "gemini-2.0-flash-exp",
    contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
    ttlSeconds: 3600, // 1 hour cache
  });
  
  return cachedContent.name;
}
```

### RAG Optimization

```typescript
// server/services/ragService.ts
export async function optimizedRagQuery(query: string, programId: string) {
  // 1. Generate query embedding (parallel with search prep)
  const [queryEmbedding, program] = await Promise.all([
    geminiService.createEmbedding(query),
    storage.getBenefitProgram(programId),
  ]);
  
  // 2. Vector similarity search with filters
  const chunks = await db.select({
    chunk: documentChunks,
    similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${queryEmbedding})`,
  })
  .from(documentChunks)
  .innerJoin(documents, eq(documents.id, documentChunks.documentId))
  .where(
    and(
      eq(documents.benefitProgramId, programId),
      eq(documents.status, "ready"),
      sql`1 - (${documentChunks.embedding} <=> ${queryEmbedding}) > 0.7` // Similarity threshold
    )
  )
  .orderBy(desc(sql`1 - (${documentChunks.embedding} <=> ${queryEmbedding})`))
  .limit(5);
  
  // 3. Deduplicate by document (take best chunk per doc)
  const uniqueChunks = chunks.reduce((acc, chunk) => {
    const docId = chunk.chunk.documentId;
    if (!acc[docId] || chunk.similarity > acc[docId].similarity) {
      acc[docId] = chunk;
    }
    return acc;
  }, {} as Record<string, typeof chunks[0]>);
  
  // 4. Generate answer with context
  const context = Object.values(uniqueChunks)
    .map(c => c.chunk.chunkText)
    .join("\n\n---\n\n");
  
  const answer = await geminiService.generateAnswer(query, context);
  
  return {
    answer,
    citations: Object.values(uniqueChunks).map(c => ({
      text: c.chunk.chunkText.substring(0, 200),
      similarity: c.similarity,
      documentId: c.chunk.documentId,
    })),
  };
}
```

---

## Monitoring & Profiling

### Performance Metrics

```typescript
// server/middleware/metrics.ts
import { performance } from "perf_hooks";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  
  res.on("finish", () => {
    const duration = performance.now() - start;
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    }
    
    // Store metrics for analytics
    metricsCollector.record({
      method: req.method,
      path: req.path,
      duration,
      statusCode: res.statusCode,
      timestamp: new Date(),
    });
  });
  
  next();
}

app.use(metricsMiddleware);
```

### Database Query Profiling

```typescript
// server/storage.ts - Log slow queries
import { sql } from "drizzle-orm";

export async function profileQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    if (duration > 500) {
      console.warn(`Slow query: ${queryName} - ${duration.toFixed(2)}ms`);
      
      // In development, run EXPLAIN ANALYZE
      if (process.env.NODE_ENV === "development") {
        // Log query plan for optimization
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Query error: ${queryName}`, error);
    throw error;
  }
}

// Usage
const documents = await profileQuery(
  () => db.select().from(documents).where(eq(documents.status, "pending")),
  "getDocuments:pending"
);
```

### Frontend Performance Monitoring

```typescript
// client/src/lib/performance.ts
export function measurePageLoad() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("load", () => {
    const perfData = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    
    const metrics = {
      dns: perfData.domainLookupEnd - perfData.domainLookupStart,
      tcp: perfData.connectEnd - perfData.connectStart,
      ttfb: perfData.responseStart - perfData.requestStart,
      download: perfData.responseEnd - perfData.responseStart,
      domParse: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
      domReady: perfData.domContentLoadedEventEnd - perfData.fetchStart,
      pageLoad: perfData.loadEventEnd - perfData.fetchStart,
    };
    
    console.log("Performance Metrics:", metrics);
    
    // Send to analytics
    fetch("/api/metrics/page-load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
    });
  });
}

// client/src/App.tsx
import { measurePageLoad } from "@/lib/performance";

useEffect(() => {
  measurePageLoad();
}, []);
```

---

## Performance Checklist

### Before Deployment

- [ ] All database indexes created and tested
- [ ] Cache TTLs configured appropriately
- [ ] Rate limiting enabled on all endpoints
- [ ] Response compression enabled
- [ ] Code splitting implemented for large routes
- [ ] Images optimized (WebP format, lazy loading)
- [ ] Bundle size analyzed and optimized
- [ ] Database queries profiled (no N+1 issues)
- [ ] API response times < 500ms for 95th percentile
- [ ] Frontend FCP < 1.5s, LCP < 2.5s
- [ ] Memory leaks checked and fixed
- [ ] Error monitoring configured (Sentry, etc.)

### Ongoing Monitoring

- [ ] Query performance dashboard
- [ ] API latency metrics by endpoint
- [ ] Cache hit/miss rates
- [ ] Document processing queue length
- [ ] Gemini API usage and costs
- [ ] Database connection pool stats
- [ ] Frontend Core Web Vitals
- [ ] Error rates and patterns

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API Response Time (p95) | < 500ms | Excluding AI endpoints |
| AI Response Time (p95) | < 3s | RAG queries, chat |
| Document Processing | < 30s | Per document (OCR + embedding) |
| Database Query Time | < 100ms | 95% of queries |
| Frontend FCP | < 1.5s | First Contentful Paint |
| Frontend LCP | < 2.5s | Largest Contentful Paint |
| Cache Hit Rate | > 80% | For static/semi-static data |
| Bundle Size | < 500KB | Initial JS bundle (gzipped) |
| Memory Usage | < 512MB | Backend per instance |

---

*Last Updated: January 2025*

# Troubleshooting Guide

Common issues, debugging patterns, and resolution steps for the Maryland Benefits Navigator system.

## Table of Contents

1. [Application Won't Start](#application-wont-start)
2. [Database Issues](#database-issues)
3. [Authentication Problems](#authentication-problems)
4. [AI/Gemini Integration Issues](#aigemini-integration-issues)
5. [PolicyEngine Problems](#policyengine-problems)
6. [Document Upload & Processing](#document-upload--processing)
7. [RAG Search Issues](#rag-search-issues)
8. [Performance Problems](#performance-problems)
9. [Frontend Issues](#frontend-issues)
10. [API Errors](#api-errors)
11. [Debugging Tools & Techniques](#debugging-tools--techniques)

---

## Application Won't Start

### Issue: `EADDRINUSE` - Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3000 npm run dev
```

### Issue: Missing Environment Variables

**Error:**
```
Error: GEMINI_API_KEY is not defined
```

**Solution:**
1. Check `.env` file exists and contains required variables
2. Verify environment variables are loaded:
```bash
# Check if env vars are loaded
node -e "console.log(process.env.GEMINI_API_KEY)"
```

3. Required variables (see `deployment-checklist.md`):
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `GEMINI_API_KEY`
   - `GCS_PROJECT_ID`, `GCS_BUCKET_NAME`

### Issue: Database Connection Failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Verify PostgreSQL is running
pg_isready

# Create database if needed
npm run db:push
```

---

## Database Issues

### Issue: Migration Errors

**Error:**
```
Error: relation "users" already exists
```

**Solution:**
```bash
# Option 1: Force push schema (CAUTION: May lose data)
npm run db:push --force

# Option 2: Drop and recreate (DEVELOPMENT ONLY)
npm run db:drop
npm run db:push

# Option 3: Manual fix
psql $DATABASE_URL
DROP TABLE IF EXISTS users CASCADE;
\q
npm run db:push
```

### Issue: Query Performance Degradation

**Symptoms:**
- Slow API responses (>500ms)
- Timeout errors
- High database CPU usage

**Debugging:**
```sql
-- Check slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;

-- Analyze query plan
EXPLAIN ANALYZE 
SELECT * FROM document_chunks WHERE document_id = 'xxx';
```

**Solution:**
1. Add indexes (see `shared/schema.ts` for existing indexes)
2. Use query caching for frequently accessed data
3. Implement pagination for large result sets
4. Consider materialized views for complex queries

### Issue: Database Connection Pool Exhausted

**Error:**
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Solution:**
```typescript
// Adjust connection pool in db.ts
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(neon(process.env.DATABASE_URL!, {
  poolQueryViaFetch: true,
  fetchConnectionCache: true,
  fetchOptions: {
    connectionTimeout: 30000, // 30 seconds
    maxConnections: 10, // Reduce if needed
  },
}));
```

---

## Authentication Problems

### Issue: Session Not Persisting

**Symptoms:**
- User logged out on page refresh
- Session cookie not set

**Solution:**
```typescript
// Check session configuration in server/index.ts
import session from 'express-session';
import PgSession from 'connect-pg-simple';

const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Important for cross-site requests
  },
});

app.use(sessionMiddleware);
```

**Debugging:**
```bash
# Check session table
psql $DATABASE_URL -c "SELECT * FROM session LIMIT 5;"

# Verify cookie is set
curl -i http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo.applicant","password":"Demo2024!"}'
# Look for Set-Cookie header
```

### Issue: CSRF Token Mismatch

**Error:**
```
403 Forbidden: CSRF token validation failed
```

**Solution:**
1. Ensure CSRF token is included in requests:
```typescript
// Frontend: Get CSRF token
const response = await fetch('/api/csrf-token');
const { token } = await response.json();

// Include in POST/PUT/DELETE requests
await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  },
  body: JSON.stringify(data),
});
```

2. Check CSRF middleware configuration in `server/index.ts`

---

## AI/Gemini Integration Issues

### Issue: Gemini API Rate Limit Exceeded

**Error:**
```
Error: 429 Too Many Requests - quota exceeded
```

**Solution:**
1. Implement exponential backoff:
```typescript
// server/services/geminiService.ts
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

2. Enable caching for embeddings (deterministic):
```typescript
// Cache embeddings in cacheService
const cacheKey = `embedding:${text}`;
const cached = cache.get(cacheKey);
if (cached) return cached;

const embedding = await geminiService.createEmbedding(text);
cache.set(cacheKey, embedding, 86400); // 24 hours
return embedding;
```

### Issue: Gemini Response Parsing Errors

**Error:**
```
Error: Cannot parse JSON response from Gemini
```

**Solution:**
```typescript
// Add robust error handling
try {
  const response = await model.generateContent(prompt);
  const text = response.response.text();
  
  // Remove markdown code blocks if present
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  
  return JSON.parse(cleanText);
} catch (error) {
  console.error('Gemini response:', text);
  console.error('Parse error:', error);
  
  // Fallback: return raw text
  return { raw: text, parsed: false };
}
```

### Issue: Empty or Invalid Embeddings

**Symptoms:**
- Vector search returns no results
- Embedding array is empty or all zeros

**Debugging:**
```typescript
// Test embedding generation
const testEmbedding = await geminiService.createEmbedding("test text");
console.log('Embedding length:', testEmbedding.length); // Should be 768
console.log('First 5 values:', testEmbedding.slice(0, 5));
console.log('All zeros?', testEmbedding.every(v => v === 0));

// Verify embedding storage
const chunk = await db.query.documentChunks.findFirst({
  where: eq(documentChunks.id, chunkId),
});
console.log('Stored embedding:', chunk?.embeddings);
```

---

## PolicyEngine Problems

### Issue: PolicyEngine Library Import Error

**Error:**
```
ImportError: libstdc++.so.6: cannot open shared object file
```

**Status:** Known issue - PolicyEngine Python library has system dependency conflicts in NixOS/Replit environment

**Workarounds:**
1. **Use RAG-only mode** (disable PolicyEngine calculations)
2. **Switch to PolicyEngine REST API:**
```typescript
// server/services/policyEngineApiService.ts
async function calculateBenefits(household: HouseholdData) {
  const response = await fetch('https://api.policyengine.org/us/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      household: transformHouseholdData(household),
      // Note: Free API returns empty results - requires paid credentials
    }),
  });
  return response.json();
}
```

3. **Build custom calculator** using USDA SNAP tables (see `replit.md` for alternatives)

### Issue: PolicyEngine Returns Zero Benefits

**Symptoms:**
- All benefit amounts are $0
- Eligibility always returns false

**Debugging:**
```python
# Test PolicyEngine directly (if library works)
from policyengine_us import Simulation

situation = {
  "people": {"person1": {"age": {"2024": 30}}},
  "households": {"household1": {"members": ["person1"]}},
  "spm_units": {"spm_unit1": {"members": ["person1"]}},
}

sim = Simulation(situation=situation)
snap = sim.calculate("snap", "2024")
print(f"SNAP benefit: ${snap}")

# Check if household data is formatted correctly
print("Input situation:", json.dumps(situation, indent=2))
```

**Common Issues:**
- Income not converted to annual (PolicyEngine expects annual income)
- State not specified (default is not Maryland)
- Missing required household members
- Asset values incorrectly formatted

---

## Document Upload & Processing

### Issue: File Upload Fails to Google Cloud Storage

**Error:**
```
Error: Storage bucket not accessible
```

**Solution:**
1. Verify GCS credentials:
```bash
echo $GCS_PROJECT_ID
echo $GCS_BUCKET_NAME
# GCS_SERVICE_ACCOUNT_KEY should be base64 encoded
```

2. Test bucket access:
```typescript
// server/objectStorage.ts
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: JSON.parse(
    Buffer.from(process.env.GCS_SERVICE_ACCOUNT_KEY!, 'base64').toString()
  ),
});

// Test bucket exists
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
const [exists] = await bucket.exists();
console.log('Bucket exists:', exists);

// Test upload permissions
const testFile = bucket.file('test-upload.txt');
await testFile.save('test content');
console.log('Upload successful');
```

3. Check bucket permissions (service account needs Storage Object Admin role)

### Issue: OCR Extraction Returns Empty Text

**Symptoms:**
- Document uploaded successfully but no text extracted
- `extractedText` field is empty or null

**Debugging:**
```typescript
// Test OCR directly
const result = await geminiService.extractTextFromImage(imageBuffer);
console.log('Extracted text length:', result.length);
console.log('First 200 chars:', result.substring(0, 200));

// Check image quality
console.log('Image size:', imageBuffer.length, 'bytes');
console.log('Image type:', fileType); // Should be image/png, image/jpeg, etc.
```

**Solutions:**
- Increase image resolution (min 300 DPI recommended)
- Convert PDF to images first (use pdf-parse or similar)
- Try alternative OCR (Tesseract OCR as fallback)

### Issue: Document Classification Incorrect

**Symptoms:**
- Policy document classified as wrong type
- Section extraction misses key sections

**Solution:**
```typescript
// Improve classification prompt in geminiService
const classificationPrompt = `
Analyze this Maryland policy document and classify it.

Document types:
- policy_manual: COMAR regulations, program manuals
- application_form: Benefit application forms
- notice_template: Client notice templates
- guidance_memo: DHS guidance memos
- faq: Frequently asked questions

Benefit programs:
- md_snap: Food Supplement Program
- md_medicaid: Medical Assistance
- md_tanf: Temporary Cash Assistance
- md_ohep: Energy Assistance (MEAP/EUSP)
- md_wic: Women, Infants, Children
- md_mchp: Children's Health Program
- irs_vita: Tax assistance

Return JSON with:
{
  "documentType": "policy_manual" | "application_form" | etc.,
  "benefitProgram": "md_snap" | "md_medicaid" | etc.,
  "confidence": 0.0-1.0,
  "sections": [{"title": "...", "number": "..."}]
}

Document text:
${documentText}
`;
```

---

## RAG Search Issues

### Issue: Search Returns No Results

**Symptoms:**
- Valid queries return empty results
- Vector search finds no similar chunks

**Debugging:**
```typescript
// 1. Check if embeddings exist
const chunksWithEmbeddings = await db.query.documentChunks.findMany({
  where: not(isNull(documentChunks.embeddings)),
  limit: 5,
});
console.log('Chunks with embeddings:', chunksWithEmbeddings.length);

// 2. Test embedding parsing and similarity calculation
const queryEmbedding = await geminiService.createEmbedding(query);
const testChunk = chunksWithEmbeddings[0];

// Parse embeddings from JSON string
const chunkEmbedding = JSON.parse(testChunk.embeddings as string);
console.log('Query embedding length:', queryEmbedding.length);
console.log('Chunk embedding length:', chunkEmbedding.length);

// Calculate cosine similarity (in-memory)
const similarity = ragService.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
console.log('Cosine similarity:', similarity); // Should be 0 to 1

// 3. Lower similarity threshold in RAG service
// Edit server/services/ragService.ts to lower threshold from 0.6 to 0.3
const results = await ragService.search(query, programId, limit);
```

**Solutions:**
- Re-generate embeddings for existing documents
- Check embedding model consistency (always use `text-embedding-004`)
- Verify embedding storage format (array of floats)

### Issue: Incorrect Citations Returned

**Symptoms:**
- Citations don't match query content
- Wrong document sections returned

**Solution:**
```typescript
// Improve citation ranking in ragService
// Note: Embeddings are stored as JSON text, similarity calculated in-memory

export async function search(
  query: string, 
  benefitProgramId?: string,
  limit: number = 5
) {
  const queryEmbedding = await geminiService.createEmbedding(query);
  
  // Fetch documents with embeddings
  const chunks = await db.query.documentChunks.findMany({
    where: and(
      not(isNull(documentChunks.embeddings)),
      benefitProgramId 
        ? eq(documents.benefitProgramId, benefitProgramId)
        : undefined
    ),
    with: { document: true },
  });
  
  // Calculate similarity in-memory
  const results = chunks.map(chunk => {
    const chunkEmbedding = JSON.parse(chunk.embeddings as string);
    const similarity = calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
    
    return {
      ...chunk,
      similarity,
      document: chunk.document,
    };
  })
  .filter(r => r.similarity > 0.6) // Similarity threshold
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, limit);
  
  // Optional: Re-rank by relevance using Gemini
  return results;
}
```

---

## Performance Problems

### Issue: Slow Page Load Times (>3 seconds)

**Debugging:**
```bash
# Check bundle size
npm run build
ls -lh dist/assets/*.js

# Profile frontend performance
# Open Chrome DevTools > Performance tab
# Record page load and analyze
```

**Solutions:**
1. Code splitting:
```typescript
// Lazy load routes
const AdminPage = lazy(() => import('@/pages/Admin'));
const ScenariosPage = lazy(() => import('@/pages/Scenarios'));

<Suspense fallback={<LoadingSpinner />}>
  <Route path="/admin" component={AdminPage} />
</Suspense>
```

2. Optimize images:
```bash
# Compress images
npx sharp-cli --input src/assets --output dist/assets --quality 80
```

3. Enable browser caching:
```typescript
// server/index.ts
app.use('/assets', express.static('dist/assets', {
  maxAge: '1y', // Cache static assets for 1 year
  immutable: true,
}));
```

### Issue: High Memory Usage

**Symptoms:**
- Memory usage grows over time
- Application crashes with OOM errors

**Debugging:**
```bash
# Monitor memory usage
node --expose-gc --max-old-space-size=2048 server/index.ts

# Take heap snapshot
node --inspect server/index.ts
# Open chrome://inspect
# Click "Inspect" > "Memory" > "Take heap snapshot"
```

**Solutions:**
1. Fix memory leaks:
```typescript
// Clear caches periodically
setInterval(() => {
  cache.flushAll();
}, 24 * 60 * 60 * 1000); // Daily

// Remove event listeners
useEffect(() => {
  const handler = () => {};
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

2. Implement streaming for large responses:
```typescript
// Stream large JSON responses
app.get('/api/large-data', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.write('[');
  
  for await (const item of fetchLargeDataset()) {
    res.write(JSON.stringify(item));
    res.write(',');
  }
  
  res.write(']');
  res.end();
});
```

---

## Frontend Issues

### Issue: React Query Cache Not Invalidating

**Symptoms:**
- Stale data displayed after mutations
- UI doesn't update after POST/PUT/DELETE

**Solution:**
```typescript
// Ensure cache invalidation after mutations
const mutation = useMutation({
  mutationFn: async (data) => apiRequest('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  onSuccess: () => {
    // Invalidate specific query
    queryClient.invalidateQueries({ queryKey: ['/api/data'] });
    
    // Or invalidate all queries with prefix
    queryClient.invalidateQueries({ queryKey: ['/api'] });
  },
});
```

### Issue: Form Validation Not Working

**Symptoms:**
- Form submits with invalid data
- Validation errors not displayed

**Debugging:**
```typescript
// Log form state
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {},
});

console.log('Form errors:', form.formState.errors);
console.log('Form values:', form.getValues());
console.log('Is valid:', form.formState.isValid);
```

**Solution:**
```typescript
// Ensure form fields have correct names
<FormField
  control={form.control}
  name="username" // Must match schema key
  render={({ field }) => (
    <FormItem>
      <FormLabel>Username</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Displays validation errors */}
    </FormItem>
  )}
/>
```

### Issue: Dark Mode Not Persisting

**Solution:**
```typescript
// ThemeProvider should persist to localStorage
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

---

## API Errors

### Common Error Codes

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 400 | Bad Request | Invalid request data | Validate input with Zod schema |
| 401 | Unauthorized | Not logged in | Redirect to login page |
| 403 | Forbidden | No permission | Check user role |
| 404 | Not Found | Resource doesn't exist | Verify ID/slug is correct |
| 429 | Too Many Requests | Rate limit exceeded | Implement exponential backoff |
| 500 | Internal Server Error | Server-side error | Check server logs |
| 503 | Service Unavailable | Database/service down | Check health endpoint |

### Issue: Intermittent 500 Errors

**Debugging:**
```bash
# Check server logs
tail -f logs/error.log

# Enable detailed error logging
NODE_ENV=development npm run dev
```

**Common Causes:**
1. Unhandled promise rejections
2. Database connection issues
3. Gemini API failures
4. Invalid environment variables

**Solution:**
```typescript
// Add global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('Request:', {
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers,
  });

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});
```

---

## Debugging Tools & Techniques

### Server-Side Debugging

**VSCode Debug Configuration:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Node.js Inspect:**
```bash
# Start with inspector
node --inspect server/index.ts

# Connect Chrome DevTools
# Open chrome://inspect
# Click "inspect" on target
```

### Database Debugging

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active queries
SELECT pid, usename, state, query, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

### Frontend Debugging

**React DevTools:**
- Install React DevTools extension
- Inspect component props and state
- Profile component renders

**Network Tab:**
- Monitor API requests/responses
- Check request headers (CSRF tokens, cookies)
- Verify response status codes

**Console Logging:**
```typescript
// Structured logging
console.group('API Request');
console.log('URL:', url);
console.log('Method:', method);
console.log('Body:', body);
console.groupEnd();

// Conditional logging
if (import.meta.env.DEV) {
  console.debug('Debug info:', data);
}
```

### Performance Profiling

**Chrome DevTools Performance:**
1. Open DevTools > Performance tab
2. Click Record
3. Perform slow action
4. Stop recording
5. Analyze flame graph for bottlenecks

**React Profiler:**
```typescript
import { Profiler } from 'react';

<Profiler id="ExpensiveComponent" onRender={(id, phase, actualDuration) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}}>
  <ExpensiveComponent />
</Profiler>
```

---

## Quick Reference

### Health Check

```bash
# Check all services
curl http://localhost:5000/health

# Expected response
{
  "uptime": 12345,
  "status": "OK",
  "checks": {
    "database": "OK",
    "gemini": "OK",
    "storage": "OK"
  }
}
```

### Log Locations

- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Database logs: Check Neon dashboard
- Workflow logs: Replit workspace

### Common Commands

```bash
# Restart application
npm run dev

# Check database
npm run db:push
psql $DATABASE_URL

# Run tests
npm test

# Type check
npm run typecheck

# Build for production
npm run build
```

---

## Getting Help

1. **Check logs first** - Most issues are logged with details
2. **Reproduce in isolation** - Isolate the problem to a specific component
3. **Search documentation** - Check `ai-context/` files for guidance
4. **Test with demo data** - Use demo accounts to verify functionality
5. **Contact support** - If all else fails, provide:
   - Error message and stack trace
   - Steps to reproduce
   - Environment details (Node version, OS)
   - Recent changes (git log)

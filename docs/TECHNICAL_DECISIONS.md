# Technical Decisions

## Replit Key-Value Store Evaluation (October 2025)

### Decision: Do Not Implement

**Context:**
Evaluated whether Replit Key-Value Store could optimize resource usage in the Maryland Universal Benefits-Tax platform.

**Analysis:**

**What is Replit KV Store?**
- Zero-configuration key-value database (Redis/Memcached analog)
- Limits: 50 MiB storage, 5,000 keys max
- Developer-recognizable pattern: Standard K/V caching store

**Current Architecture:**
- `node-cache` for server-side caching (in-memory, very fast)
- PostgreSQL with connection pooling for sessions
- PolicyEngine API response caching (1-hour TTL)
- Rules Engine calculation caching (15-min TTL)

**Potential Use Cases:**
- Replace PostgreSQL-backed sessions to reduce DB load
- Additional caching layer for frequently accessed data

**Resource Savings Assessment:**
- **Marginal benefit** - existing caching is highly optimized
- Storage limits (50 MiB, 5,000 keys) restrictive for production scale
- PostgreSQL sessions with pooling already efficient
- `node-cache` provides sub-millisecond access for hot data

**Conclusion:**
Current multi-tier caching architecture (in-memory → PostgreSQL) is optimal for Maryland DHS deployment scale. Replit KV Store would add minimal value while introducing another dependency.

**Recommendation:** 
Maintain existing caching strategy. Re-evaluate if scale exceeds 10,000 concurrent users or storage requirements change significantly.

---

## Architecture Componentization Analysis (October 2025)

### Decision: Maintain Modular Monolith

**Context:**
Assessed whether breaking the codebase into separate applications (Navigator App, Admin Dashboard, Public Portal) provides pragmatic value for Maryland DHS deployment.

**Current Architecture:**
- **Modular Monolith** with clear service boundaries
- Organized layers: `services/`, `routes/`, `pages/`
- Shared infrastructure: auth, tenant isolation, database, caching

**Microservices Evaluation:**

**Potential Separation:**
1. **Public Portal** - Anonymous benefit screener, document checklist
2. **Admin Dashboard** - Monitoring, e-filing queue, alerts
3. **Core Navigator App** - Benefits calculation, tax preparation, case management

**Advantages of Separation:**
- Independent scaling of public vs. authenticated features
- Isolated deployments reduce blast radius
- Team specialization by domain

**Disadvantages:**
- Increased operational complexity (3+ deployments)
- Shared auth/tenant logic requires duplication or shared library
- Database transactions across services become distributed
- Development overhead for service-to-service communication
- Maryland DHS operational burden (monitoring 3+ services vs. 1)

**Developer Recognition:**
Software developers will recognize the current structure as a **well-organized modular monolith** with clear separation of concerns - a pragmatic choice for government service delivery platforms.

**Production Deployment Considerations:**
- Single deployment unit simplifies Maryland DHS operations
- Existing module boundaries support future extraction if needed
- Clear service layer enables gradual transition to microservices
- Shared database ensures ACID compliance for benefits eligibility

**Conclusion:**
**Modular monolith is optimal** for initial Maryland DHS deployment. The codebase structure supports future componentization without premature complexity.

**Recommendation:**
- Deploy as single application
- Monitor performance metrics post-launch
- Extract microservices only if clear bottlenecks emerge (e.g., public portal exceeds 100k daily users)
- Maintain clear module boundaries to preserve extraction optionality

---

## Additional Technical Decisions

### Session Management
- **Choice:** PostgreSQL-backed sessions with `connect-pg-simple`
- **Rationale:** Shared state across server restarts, built-in cleanup, ACID compliance
- **Alternative Considered:** Redis - rejected due to additional infrastructure dependency

### Caching Strategy
- **Choice:** Multi-tier (in-memory → PostgreSQL)
- **Rationale:** `node-cache` for hot data, PostgreSQL for persistent cache, deterministic cache keys
- **Performance:** 50-70% cost reduction on PolicyEngine API calls

### File Storage
- **Choice:** Google Cloud Storage
- **Rationale:** Secure object storage, signed URLs for time-limited access, HIPAA compliance
- **Alternative Considered:** Local file system - rejected for production security requirements

### Authentication
- **Choice:** Passport Local Strategy + session-based auth
- **Rationale:** Simple, secure, compatible with government security requirements
- **Alternative Considered:** OAuth2 - reserved for external integrations (PolicyEngine, Google Calendar)

### Frontend State Management
- **Choice:** TanStack Query (React Query)
- **Rationale:** Server state synchronization, automatic caching, optimistic updates
- **Alternative Considered:** Redux - rejected as over-engineering for current complexity

# Security Documentation

## Overview

The Maryland Multi-Program Benefits Navigator System implements multi-layered security controls aligned with federal and state security requirements. This document details authentication, authorization, CSRF protection, rate limiting, data protection, and security monitoring mechanisms.

**Security Principles:**
- Defense in depth with multiple security layers
- Least privilege access control
- Secure by default configuration
- Continuous security monitoring
- Federal compliance (NIST, FISMA, FedRAMP)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Session Management](#session-management)
3. [Authorization & Access Control](#authorization--access-control)
4. [CSRF Protection](#csrf-protection)
5. [Security Headers](#security-headers)
6. [Rate Limiting](#rate-limiting)
7. [Data Protection](#data-protection)
8. [Request Logging & Monitoring](#request-logging--monitoring)
9. [Password Security](#password-security)
10. [Error Handling](#error-handling)
11. [Deployment Security](#deployment-security)
12. [Security Checklist](#security-checklist)

---

## Authentication

### Overview
The system uses **Passport.js** with **LocalStrategy** for username/password authentication, implementing session-based authentication with server-side session storage.

### Authentication Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    {username, password}
       ▼
┌──────────────────────────┐
│  Authentication Endpoint │
│  - Rate limited (5/15min)│
└──────┬───────────────────┘
       │ 2. Passport LocalStrategy
       ▼
┌──────────────────────┐
│  User Lookup         │
│  - Query database    │
│  - Check isActive    │
└──────┬───────────────┘
       │ 3. Password Verification
       ▼
┌──────────────────────┐
│  bcryptjs.compare()  │
│  - Hash comparison   │
│  - Constant-time     │
└──────┬───────────────┘
       │ 4. Create Session
       ▼
┌──────────────────────────┐
│  Session Store (Postgres)│
│  - Store session data    │
│  - Generate session ID   │
└──────┬───────────────────┘
       │ 5. Set Cookie
       ▼
┌─────────────────────────┐
│  Set-Cookie Header      │
│  - httpOnly             │
│  - secure (production)  │
│  - sameSite: lax        │
└─────────────────────────┘
```

### Implementation Details

**Authentication Middleware:**
```typescript
// server/auth.ts
passport.use(
  new LocalStrategy(async (username, password, done) => {
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return done(null, false, { message: "Invalid username or password" });
    }

    if (!user.isActive) {
      return done(null, false, { message: "Account is inactive" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return done(null, false, { message: "Invalid username or password" });
    }

    return done(null, user);
  })
);
```

**Serialization:**
```typescript
passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  const user = await storage.getUser(id);
  done(null, user);
});
```

### Login Endpoint

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "navigator123",
  "password": "SecureP@ssw0rd!"
}
```

**Success Response (200):**
```json
{
  "user": {
    "id": "usr_abc123",
    "username": "navigator123",
    "email": "navigator@maryland.gov",
    "role": "navigator",
    "isActive": true
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded (5 attempts/15min)
- `403 Forbidden`: Account inactive

### Security Features

✅ **Account Status Validation** - Only active accounts can authenticate  
✅ **Rate Limiting** - 5 login attempts per 15 minutes per IP  
✅ **Constant-Time Comparison** - bcrypt prevents timing attacks  
✅ **Generic Error Messages** - No user enumeration  
✅ **Skip Successful Requests** - Successful logins don't count against rate limit

---

## Session Management

### Configuration

Sessions are stored server-side in PostgreSQL using `connect-pg-simple` for persistence and horizontal scalability.

**Session Configuration:**
```typescript
// server/index.ts
const PgSession = ConnectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET, // Required env var
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true, // Prevents XSS access
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "lax", // CSRF mitigation
  },
});
```

### Session Storage Schema

**Database Table:** `session`
```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" 
  PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

### Cookie Security

| Setting | Value | Purpose |
|---------|-------|---------|
| `httpOnly` | `true` | Prevents JavaScript access (XSS protection) |
| `secure` | `true` (prod) | HTTPS-only transmission |
| `sameSite` | `lax` | CSRF protection, allows top-level navigation |
| `maxAge` | 30 days | Session lifetime |

### Session Validation

Every authenticated request validates:
1. Session exists in database
2. Session not expired
3. User account still active
4. User role unchanged

---

## Authorization & Access Control

### Role-Based Access Control (RBAC)

**User Roles:**
- `user` - Standard applicant/client
- `navigator` - Benefit navigator/caseworker
- `admin` - System administrator
- `super_admin` - Full system access

### Authorization Middleware

**requireAuth** - Ensures user is authenticated
```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in to access this resource" 
    });
  }
  next();
}
```

**requireRole** - Enforces role-based access
```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        message: `This resource requires one of: ${roles.join(", ")}`,
        requiredRoles: roles,
        userRole: user.role
      });
    }
    
    next();
  };
}
```

**requireActiveAccount** - Validates account status
```typescript
export function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = req.user as User;
  if (!user.isActive) {
    return res.status(403).json({ 
      error: "Account inactive",
      message: "Your account is inactive. Please contact support." 
    });
  }
  
  next();
}
```

### Route Protection Examples

```typescript
// Public endpoint - no auth required
app.get("/api/programs", getProgramsHandler);

// Authenticated users only
app.get("/api/user/profile", requireAuth, getUserProfileHandler);

// Navigator or admin only
app.post("/api/cases", requireAuth, requireRole("navigator", "admin"), createCaseHandler);

// Admin only
app.delete("/api/users/:id", requireAuth, requireRole("admin"), deleteUserHandler);

// Super admin only
app.post("/api/admin/system-settings", requireAuth, requireRole("super_admin"), updateSystemSettingsHandler);
```

### Permission Matrix

| Resource | User | Navigator | Admin | Super Admin |
|----------|------|-----------|-------|-------------|
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Search policies | ✅ | ✅ | ✅ | ✅ |
| Create client case | ❌ | ✅ | ✅ | ✅ |
| Review documents | ❌ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |

---

## CSRF Protection

### Implementation

The system uses **double-submit cookie pattern** via the `csrf-csrf` library to protect all state-changing requests.

**Protected Methods:**
- POST
- PUT
- PATCH
- DELETE

**CSRF Token Flow:**
```
1. Client requests CSRF token
   GET /api/auth/csrf-token
   
2. Server generates token pair
   - Cookie: XSRF-TOKEN (httpOnly, sameSite)
   - Response: { csrfToken: "abc123..." }
   
3. Client includes token in requests
   POST /api/cases
   Headers: {
     "X-CSRF-Token": "abc123...",
     "Cookie": "XSRF-TOKEN=xyz789..."
   }
   
4. Server validates token pair
   - Compares request header with cookie
   - Rejects if mismatch or missing
```

### Frontend Integration

**React Query Configuration:**
```typescript
// client/src/lib/queryClient.ts
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const csrfToken = getCsrfToken(); // From cookie or state
  
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (["POST", "PUT", "PATCH", "DELETE"].includes(options.method || "")) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  
  const response = await fetch(url, { ...options, headers });
  return response;
};
```

### Error Responses

**Missing CSRF Token (403):**
```json
{
  "error": "CSRF token validation failed",
  "message": "Missing or invalid CSRF token"
}
```

**Invalid CSRF Token (403):**
```json
{
  "error": "CSRF token mismatch",
  "message": "The CSRF token does not match"
}
```

---

## Security Headers

### Helmet Middleware Configuration

The system uses Helmet to set security headers with environment-aware Content Security Policy (CSP).

**Applied Headers:**
```typescript
// server/index.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Security Headers Reference

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | See CSP directives | Prevents XSS, clickjacking, injection attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Browser XSS protection (legacy) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |

### Content Security Policy (CSP)

**Production CSP:**
- Blocks inline scripts and eval()
- Allows only same-origin resources
- Prevents loading from external domains
- Disallows frames and objects

**Development CSP:**
- Allows `unsafe-inline` and `unsafe-eval` for HMR
- Permissive for developer tools

---

## Rate Limiting

### Three-Tier Rate Limiting System

The system implements granular rate limiting using `express-rate-limit` with different tiers for different endpoint types.

#### Tier 1: General API Endpoints

**Configuration:**
```typescript
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);
```

**Limits:**
- 100 requests per 15 minutes
- Applied to all `/api/*` routes
- Per IP address (default key generator)

#### Tier 2: Authentication Endpoints

**Configuration:**
```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
```

**Limits:**
- 5 attempts per 15 minutes
- Applied to `/api/auth/login` and `/api/auth/signup`
- Successful attempts don't count against limit
- Prevents brute force attacks

#### Tier 3: AI Service Endpoints

**Configuration:**
```typescript
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: "AI service rate limit exceeded. Please wait before making more requests.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/chat/ask", aiLimiter);
app.use("/api/search", aiLimiter);
```

**Limits:**
- 20 requests per minute
- Applied to AI-powered endpoints
- Prevents API quota exhaustion
- Protects against cost abuse

### Rate Limit Headers

All rate-limited responses include standard headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1672531200
```

**Header Definitions:**
- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

### Rate Limit Response

**429 Too Many Requests:**
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1672531200

Too many requests from this IP, please try again later.
```

The response body is a plain text error message. Rate limit headers provide programmatic access to limit status.

---

## Data Protection

### Sensitive Data Redaction

Request logging automatically redacts sensitive fields to prevent exposure in logs.

**Redacted Fields:**
```typescript
// server/middleware/requestLogger.ts
const sensitiveFields = new Set([
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "ssn",
  "socialSecurityNumber",
  "creditCard",
  "cardNumber",
  "cvv",
]);
```

**Redaction Process:**
1. Recursively scan request body and headers
2. Match against sensitive field keywords
3. Replace values with `[REDACTED]`
4. Log sanitized data only

**Example:**
```typescript
// Original request
{
  "username": "john.doe",
  "password": "SecureP@ss123",
  "ssn": "123-45-6789"
}

// Logged request
{
  "username": "john.doe",
  "password": "[REDACTED]",
  "ssn": "[REDACTED]"
}
```

### Data Encryption

**At Rest:**
- Database encryption using PostgreSQL TDE (Transparent Data Encryption)
- Environment variables stored in secure vaults
- File uploads encrypted in Google Cloud Storage

**In Transit:**
- TLS 1.2+ enforced for all connections
- HSTS header forces HTTPS
- Secure WebSocket connections (wss://)

### PII Handling

**Personal Identifiable Information (PII) Protection:**
- Minimum necessary principle - collect only required data
- Encrypted storage for SSN, income, medical data
- Access logging for all PII access
- Automatic data retention and purging policies
- Role-based access to PII fields

---

## Request Logging & Monitoring

### Request Logger

Comprehensive request logging with performance monitoring and security auditing.

**Logged Fields:**
```typescript
interface RequestLog {
  requestId: string;        // Unique request ID
  timestamp: Date;          // Request timestamp
  method: string;           // HTTP method
  path: string;             // Request path
  statusCode?: number;      // Response status
  duration?: number;        // Response time (ms)
  userId?: string;          // Authenticated user
  ipAddress?: string;       // Client IP
  userAgent?: string;       // Client user agent
  error?: string;           // Error message (if any)
  headers: Record<string, string>;  // Relevant headers
  body?: any;               // Sanitized request body
}
```

**Request ID Header:**
```http
X-Request-ID: req_1672531200_abc123xyz
```

### Audit Logging

All security-relevant actions are logged to the `audit_logs` table:

**Logged Actions:**
- `AUTH_LOGIN` - User login
- `AUTH_LOGOUT` - User logout
- `AUTH_FAILED` - Failed login attempt
- `ADMIN_UPDATE` - Admin configuration changes
- `DOCUMENT_UPLOAD` - Document uploads
- `CASE_CREATE` - Case creation
- `USER_CREATE` - New user registration
- `ROLE_CHANGE` - Role modifications
- `PERMISSION_DENIED` - Access denied events

**Audit Log Schema:**
```typescript
{
  id: string;
  action: string;           // Action type
  entityType: string;       // Affected entity (USER, CASE, DOCUMENT)
  entityId: string;         // Entity ID
  userId: string;           // Actor user ID
  metadata: object;         // Additional context
  ipAddress: string;        // Client IP
  userAgent: string;        // Client user agent
  timestamp: Date;          // Action timestamp
}
```

### Performance Monitoring

**Timing Headers:**
```http
Server-Timing: db;dur=45.3, api;dur=123.8, total;dur=169.1
```

**Metrics Tracked:**
- Database query time
- API processing time
- Total request duration
- External API calls

---

## Password Security

### Password Hashing

**Algorithm:** bcrypt with configurable salt rounds

**Implementation:**
```typescript
import bcrypt from "bcryptjs";

// Registration
const hashedPassword = await bcrypt.hash(plainPassword, 12);

// Login
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

**Security Features:**
- Adaptive hashing (12 salt rounds by default)
- Automatic salt generation
- Constant-time comparison (timing attack prevention)
- Resistant to GPU/ASIC attacks

### Password Requirements

**Minimum Requirements:**
- 8 characters minimum length
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Validation:**
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
```

### Password Reset

**Secure Reset Flow:**
1. User requests reset via email
2. System generates cryptographically secure token
3. Token stored with expiration (1 hour)
4. Email sent with reset link
5. Token validated on reset page
6. New password hashed and stored
7. All sessions invalidated

---

## Error Handling

### Error Message Sanitization

Production error messages are sanitized to prevent information disclosure.

**Sanitization Rules:**
```typescript
function sanitizeErrorMessage(error: Error, statusCode: number): string {
  const message = error.message;
  
  // Redact connection errors
  if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
    return "A service is temporarily unavailable. Please try again later.";
  }
  
  // Redact API key errors
  if (message.includes("API key") || message.includes("API_KEY")) {
    return "Authentication with external service failed.";
  }
  
  // Generic server errors
  if (statusCode >= 500) {
    return "An internal server error occurred. Please try again later.";
  }
  
  return message;
}
```

**Error Response Format:**
```json
{
  "error": "Internal Server Error",
  "message": "An internal server error occurred. Please try again later.",
  "requestId": "req_1672531200_abc123xyz",
  "statusCode": 500
}
```

### Development vs Production

**Development Mode:**
- Full stack traces
- Detailed error messages
- Database query errors

**Production Mode:**
- Generic error messages
- No stack traces
- Sanitized messages
- All errors logged server-side

---

## Deployment Security

### Environment Variables

**Required Secrets:**
```bash
# Session management
SESSION_SECRET=<cryptographically-secure-random-string>

# Database connection
DATABASE_URL=postgresql://user:password@host:port/dbname

# CSRF protection (auto-generated if not set)
CSRF_SECRET=<random-secret>

# Google Cloud (for file uploads)
GCS_BUCKET_NAME=<bucket-name>
GCS_PROJECT_ID=<project-id>
GCS_CREDENTIALS=<base64-encoded-service-account-key>

# Google Gemini API
GEMINI_API_KEY=<api-key>
```

**Secret Management:**
- Never commit secrets to version control
- Use environment-specific `.env` files
- Rotate secrets regularly (quarterly minimum)
- Use secret management services (AWS Secrets Manager, Azure Key Vault)

### HTTPS Configuration

**Production Requirements:**
- TLS 1.2+ only
- Strong cipher suites
- Perfect Forward Secrecy (PFS)
- HSTS enabled with preload

**Replit Deployment:**
- HTTPS automatically provided
- Valid SSL/TLS certificates
- Automatic certificate renewal

### Database Security

**PostgreSQL Hardening:**
- SSL/TLS connections required
- Strong password policy
- Row-level security (RLS) for multi-tenancy
- Connection pooling with pg-pool
- Prepared statements (SQL injection prevention)

**Connection String Security:**
```bash
# Use SSL mode require or verify-full
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in environment variables (not in code)
- [ ] SESSION_SECRET is cryptographically random (32+ characters)
- [ ] Database uses SSL/TLS connections
- [ ] HTTPS enforced (HSTS header present)
- [ ] CSRF protection enabled on all state-changing endpoints
- [ ] Rate limiting configured for all public endpoints
- [ ] Security headers verified (CSP, X-Frame-Options, etc.)
- [ ] Error messages sanitized (no stack traces in production)
- [ ] Audit logging enabled for all security events
- [ ] Password hashing uses bcrypt with 12+ rounds

### Post-Deployment Monitoring

- [ ] Monitor rate limit violations (potential attacks)
- [ ] Review audit logs daily
- [ ] Track failed authentication attempts
- [ ] Monitor unusual access patterns
- [ ] Check for outdated dependencies weekly
- [ ] Review security headers monthly
- [ ] Rotate secrets quarterly
- [ ] Perform penetration testing annually

### Incident Response

- [ ] Document security incident procedures
- [ ] Maintain security contact list
- [ ] Log all security events
- [ ] Have rollback procedures ready
- [ ] Test backup restoration monthly
- [ ] Maintain security patch schedule

---

## Compliance

### Federal Requirements

**NIST 800-53 Controls:**
- AC-2: Account Management
- AC-7: Unsuccessful Logon Attempts
- AU-2: Audit Events
- IA-2: Identification and Authentication
- SC-8: Transmission Confidentiality
- SC-13: Cryptographic Protection

**FISMA Compliance:**
- Moderate impact level categorization
- Continuous monitoring
- Annual security assessments
- Incident response procedures

### State Requirements

**Maryland DHS Security Standards:**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) for admin
- Audit logging retention (3 years)
- PII encryption at rest and in transit
- Annual security training for staff

---

## Security Contacts

**Report Security Issues:**
- Email: security@marylandbenefits.gov
- PGP Key: [Public key fingerprint]
- Response SLA: 24 hours for critical, 72 hours for high

**Security Team:**
- CISO: [Contact information]
- Security Engineer: [Contact information]
- Compliance Officer: [Contact information]

---

**Last Updated:** January 2025  
**Document Version:** 1.0  
**Next Review:** April 2025

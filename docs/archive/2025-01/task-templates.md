# Task Templates

Reusable task templates for common development workflows in the Maryland Benefits Navigator system.

## Table of Contents

1. [Adding a New Benefit Program](#adding-a-new-benefit-program)
2. [Creating a New API Endpoint](#creating-a-new-api-endpoint)
3. [Adding a New Frontend Page](#adding-a-new-frontend-page)
4. [Implementing Document Processing](#implementing-document-processing)
5. [Creating a Rules Extraction Pipeline](#creating-a-rules-extraction-pipeline)
6. [Adding Compliance Validation](#adding-compliance-validation)
7. [Building a Dashboard Widget](#building-a-dashboard-widget)
8. [Implementing Multi-Benefit Calculations](#implementing-multi-benefit-calculations)
9. [Adding Notification Types](#adding-notification-types)
10. [Creating Admin Tools](#creating-admin-tools)

---

## Adding a New Benefit Program

**Checklist:**

- [ ] Add program to `benefit_programs` table via schema.ts
- [ ] Create program-specific rules tables (income_limits, deductions, etc.)
- [ ] Implement RAG document ingestion for program policies
- [ ] Add PolicyEngine calculation logic (if applicable)
- [ ] Create program-specific UI components
- [ ] Add navigation/routing for program pages
- [ ] Implement document requirements validation
- [ ] Add program to screener and intake flows
- [ ] Create admin tools for program management
- [ ] Update documentation and help text

**Schema Changes:**

```typescript
// shared/schema.ts - Add to benefit_programs seed data
{
  id: nanoid(),
  code: "MD_PROGRAM_CODE",
  name: "Maryland Program Name",
  description: "Program description",
  adminAgency: "Agency Name",
  websiteUrl: "https://...",
  enabled: true
}

// Add program-specific rules tables if needed
export const programIncomeLimits = pgTable("program_income_limits", {
  id: varchar("id", { length: 21 }).primaryKey(),
  programId: varchar("program_id", { length: 21 }).references(() => benefitPrograms.id),
  householdSize: integer("household_size").notNull(),
  monthlyLimit: numeric("monthly_limit", { precision: 10, scale: 2 }).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  // ... more fields
});
```

**Backend Implementation:**

```typescript
// server/routes.ts - Add program-specific endpoints
app.get("/api/programs/:programCode/rules", asyncHandler(async (req, res) => {
  const { programCode } = req.params;
  
  // Get program by code first, then query rules by ID
  const program = await storage.getBenefitProgramByCode(programCode);
  if (!program) return res.status(404).json({ error: "Program not found" });
  
  const rules = await storage.getProgramRules(program.id);
  res.json({ rules });
}));

// server/storage.ts - Add storage methods
async getBenefitProgramByCode(code: string) {
  const [program] = await db.select().from(benefitPrograms)
    .where(eq(benefitPrograms.code, code))
    .limit(1);
  return program;
}

async getProgramRules(programId: string) {
  return db.select().from(programIncomeLimits)
    .where(eq(programIncomeLimits.programId, programId));
}
```

**Frontend Implementation:**

```typescript
// client/src/pages/ProgramPage.tsx
export default function ProgramPage() {
  const { programCode } = useParams();
  const { data: program } = useQuery({
    queryKey: ['/api/benefit-programs', programCode],
  });
  
  return (
    <div className="container mx-auto py-8">
      <h1>{program?.name}</h1>
      <PolicyChatWidget programId={program?.id} />
      {/* Program-specific content */}
    </div>
  );
}

// client/src/App.tsx - Add route
<Route path="/programs/:programCode" component={ProgramPage} />
```

---

## Creating a New API Endpoint

**Checklist:**

- [ ] Define TypeScript types in shared/schema.ts
- [ ] Create Zod validation schemas (insert/select)
- [ ] Add database table/columns if needed (run `npm run db:push`)
- [ ] Implement storage interface methods in server/storage.ts
- [ ] Add route handler in server/routes.ts with asyncHandler
- [ ] Add request validation using Zod schemas
- [ ] Implement error handling and logging
- [ ] Add authorization checks (role-based)
- [ ] Test with Postman/curl
- [ ] Update frontend to consume endpoint

**Pattern:**

```typescript
// 1. shared/schema.ts - Define types
export const myEntities = pgTable("my_entities", {
  id: varchar("id", { length: 21 }).primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: varchar("user_id", { length: 21 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMyEntitySchema = createInsertSchema(myEntities).omit({ id: true, createdAt: true });
export type InsertMyEntity = z.infer<typeof insertMyEntitySchema>;
export type MyEntity = typeof myEntities.$inferSelect;

// 2. server/storage.ts - Add interface & implementation
interface IStorage {
  // ... existing methods
  getMyEntities(userId: string): Promise<MyEntity[]>;
  createMyEntity(data: InsertMyEntity): Promise<MyEntity>;
}

class DbStorage implements IStorage {
  async getMyEntities(userId: string): Promise<MyEntity[]> {
    return db.select().from(myEntities).where(eq(myEntities.userId, userId));
  }
  
  async createMyEntity(data: InsertMyEntity): Promise<MyEntity> {
    const [entity] = await db.insert(myEntities).values(data).returning();
    return entity;
  }
}

// 3. server/routes.ts - Add endpoints
app.get("/api/my-entities", asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  
  const entities = await storage.getMyEntities(req.user.id);
  res.json({ entities });
}));

app.post("/api/my-entities", asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  
  const data = insertMyEntitySchema.parse(req.body);
  const entity = await storage.createMyEntity({ ...data, userId: req.user.id });
  res.status(201).json({ entity });
}));

// 4. client - Consume endpoint
const { data } = useQuery({
  queryKey: ['/api/my-entities'],
});

const createMutation = useMutation({
  mutationFn: async (data: InsertMyEntity) => {
    const res = await apiRequest("POST", "/api/my-entities", data);
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/my-entities'] });
  },
});
```

---

## Adding a New Frontend Page

**Checklist:**

- [ ] Create page component in client/src/pages/
- [ ] Add route in client/src/App.tsx
- [ ] Implement data fetching with TanStack Query
- [ ] Add loading and error states
- [ ] Implement forms with react-hook-form + Zod validation
- [ ] Add navigation links in sidebar/navbar
- [ ] Ensure mobile responsiveness
- [ ] Add ARIA labels and data-testid attributes
- [ ] Test user flows end-to-end
- [ ] Update SEO meta tags

**Pattern:**

```typescript
// client/src/pages/MyNewPage.tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMyEntitySchema, type InsertMyEntity } from "@shared/schema";

export default function MyNewPage() {
  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ['/api/my-entities'],
  });
  
  // Form setup
  const form = useForm<InsertMyEntity>({
    resolver: zodResolver(insertMyEntitySchema),
    defaultValues: { name: "" },
  });
  
  // Mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertMyEntity) => {
      const res = await apiRequest("POST", "/api/my-entities", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-entities'] });
      form.reset();
    },
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My New Page</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-name" />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </Form>
      
      <div className="mt-8">
        {data?.entities?.map((entity: any) => (
          <div key={entity.id} data-testid={`entity-${entity.id}`}>
            {entity.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// client/src/App.tsx - Add route
import MyNewPage from "@/pages/MyNewPage";

<Route path="/my-new-page" component={MyNewPage} />
```

---

## Implementing Document Processing

**Checklist:**

- [ ] Add document upload endpoint with multer or signed URLs
- [ ] Store file in Google Cloud Storage
- [ ] Create document record in database
- [ ] Implement OCR extraction (if needed)
- [ ] Run Gemini classification/analysis
- [ ] Generate semantic chunks
- [ ] Create embeddings with text-embedding-004
- [ ] Store chunks with embeddings in database
- [ ] Update document status throughout pipeline
- [ ] Handle errors and retry logic

**Pattern:**

```typescript
// server/routes.ts - Document upload with GCS
import { Storage } from "@google-cloud/storage";
const gcs = new Storage();

app.post("/api/documents/upload", asyncHandler(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  
  // Generate signed upload URL
  const filename = `${nanoid()}.pdf`;
  const bucket = gcs.bucket(process.env.GCS_BUCKET_NAME!);
  const file = bucket.file(`documents/${filename}`);
  
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: "application/pdf",
  });
  
  res.json({ uploadUrl, filename });
}));

app.post("/api/documents/process", asyncHandler(async (req, res) => {
  const { filename, programId } = req.body;
  
  // 1. Create document record
  const [doc] = await db.insert(documents).values({
    filename,
    objectPath: `documents/${filename}`,
    status: "processing",
    benefitProgramId: programId,
    uploadedBy: req.user!.id,
  }).returning();
  
  // 2. Download from GCS
  const bucket = gcs.bucket(process.env.GCS_BUCKET_NAME!);
  const [fileBuffer] = await bucket.file(`documents/${filename}`).download();
  
  // 3. Extract text (OCR if needed)
  const text = await extractTextFromPdf(fileBuffer);
  
  // 4. Gemini classification
  const classification = await geminiService.classifyDocument(text);
  
  // 5. Generate chunks
  const chunks = await semanticChunking(text);
  
  // 6. Create embeddings
  const embeddings = await geminiService.createEmbeddings(chunks.map(c => c.text));
  
  // 7. Store chunks with embeddings
  await db.insert(documentChunks).values(
    chunks.map((chunk, i) => ({
      documentId: doc.id,
      chunkText: chunk.text,
      embedding: embeddings[i],
      chunkIndex: i,
    }))
  );
  
  // 8. Update document status
  await db.update(documents)
    .set({ status: "ready", processedAt: new Date() })
    .where(eq(documents.id, doc.id));
  
  res.json({ document: doc });
}));
```

---

## Creating a Rules Extraction Pipeline

**Checklist:**

- [ ] Identify source policy documents
- [ ] Parse document structure (sections, subsections)
- [ ] Use Gemini to extract structured rules
- [ ] Define rule schema (income limits, deductions, etc.)
- [ ] Validate extracted data
- [ ] Store rules in database with effective dates
- [ ] Create audit trail for rule changes
- [ ] Add admin UI for rule review/approval
- [ ] Implement rule versioning
- [ ] Test rule accuracy against known cases

**Pattern:**

```typescript
// server/services/rulesExtraction.ts
import { GoogleGenerativeAI } from "@google/genai";

export async function extractRulesFromSection(sectionText: string, programCode: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  
  const prompt = `
Extract structured eligibility rules from this policy section:

${sectionText}

Return JSON with:
{
  "incomeLimits": [{ "householdSize": 1, "grossMonthlyLimit": 2000, ... }],
  "deductions": [{ "type": "shelter", "amount": 500, ... }],
  "categoricalEligibility": [{ "category": "SSI", "automaticEligibility": true }]
}
`;
  
  const result = await model.generateContent(prompt);
  const rules = JSON.parse(result.response.text());
  
  // Store rules in database
  if (rules.incomeLimits?.length > 0) {
    await db.insert(incomeLimits).values(
      rules.incomeLimits.map((r: any) => ({
        programId: programCode,
        householdSize: r.householdSize,
        grossMonthlyLimit: r.grossMonthlyLimit.toString(),
        effectiveDate: new Date(),
      }))
    );
  }
  
  return rules;
}
```

---

## Adding Compliance Validation

**Checklist:**

- [ ] Define compliance rule in compliance_rules table
- [ ] Implement Gemini-powered validation logic
- [ ] Create validation endpoint
- [ ] Store violations in compliance_violations table
- [ ] Add severity classification
- [ ] Implement notification system for violations
- [ ] Create admin UI for reviewing violations
- [ ] Add resolution workflow (acknowledge/resolve/dismiss)
- [ ] Generate compliance reports
- [ ] Schedule automated compliance checks

**Pattern:**

```typescript
// server/routes.ts - Compliance validation
app.post("/api/compliance/validate/:documentId", asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  
  // Get document and active compliance rules
  const document = await storage.getDocument(documentId);
  const rules = await storage.getActiveComplianceRules();
  
  const violations = [];
  
  for (const rule of rules) {
    const result = await geminiService.validateCompliance(document.content, rule);
    
    if (!result.compliant) {
      const [violation] = await db.insert(complianceViolations).values({
        documentId,
        ruleId: rule.id,
        violationType: result.violationType,
        severity: rule.severity,
        description: result.explanation,
        status: "open",
      }).returning();
      
      violations.push(violation);
      
      // Notify admins
      await notificationService.sendComplianceAlert(violation);
    }
  }
  
  res.json({ violations });
}));
```

---

## Building a Dashboard Widget

**Checklist:**

- [ ] Create widget component in client/src/components/
- [ ] Implement data fetching with useQuery
- [ ] Add loading skeleton
- [ ] Design responsive layout with Tailwind
- [ ] Add data visualization (Recharts if needed)
- [ ] Implement error handling
- [ ] Add refresh/reload functionality
- [ ] Ensure accessibility (ARIA, keyboard nav)
- [ ] Add to dashboard layout
- [ ] Test across screen sizes

**Pattern:**

```typescript
// client/src/components/dashboard/StatsWidget.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, FileText } from "lucide-react";

export function StatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/system/status'],
    refetchInterval: 30000, // Refresh every 30s
  });
  
  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-documents">
            {data?.totalDocuments || 0}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-users">
            {data?.totalUsers || 0}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Searches Today</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="stat-searches">
            {data?.totalSearches || 0}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Implementing Multi-Benefit Calculations

**Checklist:**

- [ ] Define household input schema (size, income, expenses)
- [ ] Implement PolicyEngine API integration
- [ ] Handle SNAP, Medicaid, TANF, EITC, CTC calculations
- [ ] Store calculation results in database
- [ ] Display results in comparison table
- [ ] Add scenario modeling (what-if analysis)
- [ ] Implement PDF export for client counseling
- [ ] Add data validation and error handling
- [ ] Create visualization charts (Recharts)
- [ ] Test edge cases and boundary conditions

**Pattern:**

```typescript
// server/routes.ts - Multi-benefit calculation
app.post("/api/policyengine/calculate", asyncHandler(async (req, res) => {
  const { household } = req.body;
  
  // Call PolicyEngine REST API or Python package
  const response = await fetch("https://api.policyengine.org/us/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ household }),
  });
  
  const results = await response.json();
  
  // Store calculation
  const [calc] = await db.insert(benefitCalculations).values({
    userId: req.user!.id,
    householdData: household,
    results: results.result,
    calculatedAt: new Date(),
  }).returning();
  
  res.json({
    snap: results.result.snap || 0,
    medicaid: results.result.is_medicaid_eligible || false,
    tanf: results.result.tanf || 0,
    eitc: results.result.eitc || 0,
    ctc: results.result.ctc || 0,
  });
}));

// client/src/pages/ScenarioPage.tsx - Display results
export function ScenarioResults({ calculationId }: { calculationId: string }) {
  const { data } = useQuery({
    queryKey: ['/api/scenarios', calculationId, 'calculations', 'latest'],
  });
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Benefit Estimates</h3>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>SNAP</CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${data?.snap || 0}/mo</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>EITC</CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${data?.eitc || 0}/yr</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Adding Notification Types

**Checklist:**

- [ ] Define notification type in schema
- [ ] Add notification creation logic
- [ ] Implement delivery channels (in-app, email)
- [ ] Create notification preferences UI
- [ ] Add unread count badge
- [ ] Implement mark as read functionality
- [ ] Add notification center page
- [ ] Create notification templates
- [ ] Test notification delivery
- [ ] Add notification history/archive

**Pattern:**

```typescript
// server/services/notificationService.ts
export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) {
  const [notification] = await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    metadata,
    read: false,
  }).returning();
  
  // Check user preferences
  const prefs = await storage.getNotificationPreferences(userId);
  
  if (prefs.emailNotifications && shouldSendEmail(type, prefs)) {
    await emailService.send({
      to: (await storage.getUser(userId)).email,
      subject: title,
      body: message,
    });
  }
  
  return notification;
}

// client/src/components/NotificationBell.tsx
export function NotificationBell() {
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 10000,
  });
  
  return (
    <Button variant="ghost" size="icon" asChild data-testid="button-notifications">
      <Link href="/notifications">
        <Bell className="h-5 w-5" />
        {unreadCount?.count > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
            {unreadCount.count}
          </span>
        )}
      </Link>
    </Button>
  );
}
```

---

## Creating Admin Tools

**Checklist:**

- [ ] Add admin-only routes with role check
- [ ] Create admin dashboard page
- [ ] Implement data tables with sorting/filtering
- [ ] Add CRUD operations for system entities
- [ ] Create bulk actions (approve/reject/delete)
- [ ] Add audit logging for admin actions
- [ ] Implement export functionality (CSV/Excel)
- [ ] Add system health monitoring
- [ ] Create analytics/reporting views
- [ ] Test admin workflows end-to-end

**Pattern:**

```typescript
// server/middleware/auth.ts - Role-based access
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (!["admin", "super_admin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  next();
}

// server/routes.ts - Admin endpoints
app.get("/api/admin/users", requireAdmin, asyncHandler(async (req, res) => {
  const users = await storage.getAllUsers();
  res.json({ users: users.map(u => ({ ...u, password: undefined })) });
}));

app.patch("/api/admin/users/:id/role", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  const user = await storage.updateUserRole(id, role);
  
  // Audit log
  await db.insert(auditLogs).values({
    userId: req.user!.id,
    action: "update_user_role",
    entityType: "user",
    entityId: id,
    changes: { role },
  });
  
  res.json({ user });
}));

// client/src/pages/admin/UsersPage.tsx
export default function AdminUsersPage() {
  const { data } = useQuery({
    queryKey: ['/api/admin/users'],
  });
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <DataTable
        columns={[
          { header: "Username", accessorKey: "username" },
          { header: "Role", accessorKey: "role" },
          { header: "Actions", cell: ({ row }) => <UserActions user={row.original} /> },
        ]}
        data={data?.users || []}
      />
    </div>
  );
}
```

---

## Best Practices

### General Development

1. **Always run `npm run db:push` after schema changes** - Don't write manual SQL migrations
2. **Use asyncHandler for all route handlers** - Consistent error handling
3. **Validate all request bodies with Zod** - Type safety and security
4. **Add data-testid to all interactive elements** - Enable automated testing
5. **Implement loading states for all async operations** - Better UX
6. **Use queryClient.invalidateQueries after mutations** - Keep cache fresh
7. **Add audit logs for sensitive operations** - Compliance and debugging
8. **Test edge cases and error scenarios** - Robustness
9. **Document API endpoints and complex logic** - Maintainability
10. **Follow Maryland Digital Style Guide** - Consistent branding

### Security

1. **Never expose passwords or secrets** - Use Omit<User, "password">
2. **Always check req.user before accessing user data** - Authorization
3. **Implement role-based access control** - Least privilege
4. **Validate file uploads** - Prevent malicious files
5. **Use parameterized queries** - SQL injection prevention
6. **Implement rate limiting** - DDoS protection
7. **Add CSRF protection** - Cross-site request forgery prevention
8. **Sanitize user input** - XSS prevention
9. **Use HTTPS for all external requests** - Data in transit security
10. **Log security events** - Incident response

### Performance

1. **Add database indexes for frequently queried columns** - Query optimization
2. **Use server-side caching (NodeCache) for static data** - Reduce DB load
3. **Implement pagination for large datasets** - Memory efficiency
4. **Lazy load components and routes** - Faster initial load
5. **Optimize images and assets** - Bandwidth savings
6. **Use React.memo for expensive components** - Prevent re-renders
7. **Debounce search inputs** - Reduce API calls
8. **Batch database operations** - Fewer round trips
9. **Use CDN for static assets** - Global distribution
10. **Monitor and profile performance** - Continuous improvement

---

## Quick Reference Commands

```bash
# Database
npm run db:push          # Push schema changes
npm run db:push --force  # Force push (data loss warning)
npm run db:studio        # Open Drizzle Studio

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run test             # Run tests
npm run test:ui          # Run tests with UI

# Code Quality
npm run lint             # Lint code
npm run typecheck        # TypeScript type checking
```

---

## File Locations

| Component | Location |
|-----------|----------|
| Database Schema | `shared/schema.ts` |
| API Routes | `server/routes.ts` |
| Storage Layer | `server/storage.ts` |
| Error Handling | `server/middleware/errorHandler.ts` |
| Gemini Service | `server/services/geminiService.ts` |
| RAG Service | `server/services/ragService.ts` |
| Frontend Pages | `client/src/pages/` |
| UI Components | `client/src/components/ui/` |
| Query Client | `client/src/lib/queryClient.ts` |
| Routing | `client/src/App.tsx` |
| Styles | `client/src/index.css` |
| Environment | `.env` |

---

*Last Updated: January 2025*

# Maryland Benefits Navigator - Code Patterns

## Overview

This document provides reusable code patterns and examples from the Maryland Multi-Program Benefits Navigator system. These patterns demonstrate best practices for building full-stack TypeScript applications with React, Express, and PostgreSQL.

---

## Table of Contents

1. [React Component Patterns](#react-component-patterns)
2. [API Route Patterns](#api-route-patterns)
3. [Data Fetching & Mutations](#data-fetching--mutations)
4. [Form Validation](#form-validation)
5. [Authentication](#authentication)
6. [Database Patterns](#database-patterns)
7. [AI Integration](#ai-integration)
8. [Error Handling](#error-handling)
9. [TypeScript Patterns](#typescript-patterns)
10. [Testing Patterns](#testing-patterns)

---

## React Component Patterns

### Pattern 1: ForwardRef UI Components with Variants

**Use Case:** Creating reusable UI components that support refs and multiple visual variants.

**Example: Button Component**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**Usage:**
```tsx
<Button variant="default">Save</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon">
  <X className="h-4 w-4" />
</Button>
```

**Key Concepts:**
- `React.forwardRef` enables ref forwarding to DOM elements
- `cva` (class-variance-authority) manages variants and compound variants
- `cn` utility merges Tailwind classes safely
- `asChild` prop allows rendering as a different component (e.g., `<Link>`)

---

### Pattern 2: Compound Components (Card)

**Use Case:** Building composite UI patterns with related sub-components.

**Example: Card Component**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardContent };
```

**Usage:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>SNAP Benefits</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Eligibility information...</p>
  </CardContent>
</Card>
```

---

### Pattern 3: Custom Hooks for Business Logic

**Use Case:** Encapsulating authentication logic and role-based access control.

**Example: useAuth Hook**

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isClient: boolean;
  isNavigator: boolean;
  isCaseworker: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => void;
}

export function useAuth(): AuthState {
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user, isLoading, status } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn<{ user: User | null } | null>({ on401: "returnNull" }),
    select: (data: { user: User | null } | null) => {
      if (data === null) return null;
      return data.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const isAuthenticated = status === "success" && user !== null;
  const role = isAuthenticated ? user.role : null;

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
    isClient: isAuthenticated && role === "client",
    isNavigator: isAuthenticated && role === "navigator",
    isCaseworker: isAuthenticated && role === "caseworker",
    isAdmin: isAuthenticated && (role === "admin" || role === "super_admin"),
    isSuperAdmin: isAuthenticated && role === "super_admin",
    isStaff: isAuthenticated && ["navigator", "caseworker", "admin", "super_admin"].includes(role),
    login: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  };
}
```

**Usage:**
```tsx
function Dashboard() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <h1>Welcome, {user.fullName}</h1>
      {isAdmin && <AdminPanel />}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

### Pattern 4: Page Component Structure

**Use Case:** Organizing page-level components with consistent layout and actions.

**Example: Dashboard Page**

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Calculator, FileText, Search, HelpCircle } from "lucide-react";

export default function ClientDashboard() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Check Your Eligibility",
      description: "Find out if you qualify for SNAP benefits",
      icon: Calculator,
      href: "/eligibility",
      testId: "action-eligibility",
    },
    {
      title: "Search Policies",
      description: "Get answers to your SNAP questions",
      icon: Search,
      href: "/search",
      testId: "action-search",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          Welcome{user?.fullName ? `, ${user.fullName}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Get information about Maryland's Food Supplement Program (SNAP)
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.href} className="hover:shadow-lg transition-shadow" data-testid={action.testId}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </div>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={action.href}>Go to {action.title}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Key Concepts:**
- Container with max-width for content centering
- Responsive grid layout (1 column mobile, 2 columns desktop)
- Icon components from lucide-react
- data-testid attributes for testing
- Wouter Link for client-side navigation

---

## API Route Patterns

### Pattern 5: Express Route Handlers with AsyncHandler

**Use Case:** Creating type-safe, error-handled API endpoints.

**Example: Health Check Endpoint**

```ts
import { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { asyncHandler } from "./middleware/errorHandler";
import { ragService } from "./services/ragService";

export async function registerRoutes(app: Express) {
  
  app.get("/api/health", asyncHandler(async (req, res) => {
    const healthStatus: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: "unknown", latency: null },
        geminiApi: { status: "unknown", configured: false },
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed / 1024 / 1024,
          total: process.memoryUsage().heapTotal / 1024 / 1024,
          unit: "MB"
        },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development"
      }
    };

    // Check database connectivity
    try {
      const startTime = Date.now();
      await db.execute(sql`SELECT 1 as test`);
      const latency = Date.now() - startTime;
      
      healthStatus.services.database = {
        status: "healthy",
        latency: `${latency}ms`,
        connectionActive: true
      };
    } catch (error) {
      healthStatus.services.database = {
        status: "unhealthy",
        error: "Database connection failed"
      };
    }

    // Check Gemini API
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        healthStatus.services.geminiApi.configured = true;
        const testAvailability = await ragService.checkAvailability();
        healthStatus.services.geminiApi.status = testAvailability ? "healthy" : "degraded";
      } catch (error) {
        healthStatus.services.geminiApi = {
          status: "unhealthy",
          configured: true,
          error: "Gemini API check failed"
        };
      }
    }

    res.json(healthStatus);
  }));
}
```

**Key Concepts:**
- `asyncHandler` wrapper automatically catches errors
- Service health checks (database, external APIs)
- System metrics (memory, uptime)
- Environment-aware error messages

---

### Pattern 6: Protected Routes with Authentication Middleware

**Use Case:** Requiring authentication and role-based access for API endpoints.

**Example: Protected Endpoint**

```ts
import { requireAuth, requireAdmin } from "./middleware/auth";

// Public endpoint (no auth required)
app.get("/api/benefit-programs", asyncHandler(async (req, res) => {
  const programs = await storage.getBenefitPrograms();
  res.json({ success: true, programs });
}));

// Authenticated endpoint (any logged-in user)
app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const notifications = await storage.getNotifications(userId);
  res.json({ success: true, notifications });
}));

// Admin-only endpoint
app.get("/api/audit-logs", requireAdmin, asyncHandler(async (req, res) => {
  const { action, entityType, startDate, endDate, limit, offset } = req.query;
  
  const logs = await storage.getAuditLogs({
    action: action as string,
    entityType: entityType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    limit: parseInt(limit as string) || 50,
    offset: parseInt(offset as string) || 0,
  });
  
  res.json({ success: true, logs });
}));
```

**Middleware Implementation:**

```ts
// server/middleware/auth.ts
import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const role = req.user!.role;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const role = req.user!.role;
  const staffRoles = ["navigator", "caseworker", "admin", "super_admin"];
  
  if (!staffRoles.includes(role)) {
    return res.status(403).json({ message: "Staff access required" });
  }
  
  next();
}
```

---

### Pattern 7: Request Validation with Zod

**Use Case:** Validating request bodies before processing.

**Example: User Creation Endpoint**

```ts
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

const createUserSchema = insertUserSchema.omit({ id: true, createdAt: true });

app.post("/api/users", requireAdmin, asyncHandler(async (req, res) => {
  // Validate request body
  const validationResult = createUserSchema.safeParse(req.body);
  
  if (!validationResult.success) {
    return res.status(400).json({
      message: "Invalid user data",
      errors: validationResult.error.errors
    });
  }
  
  const userData = validationResult.data;
  
  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // Create user
  const user = await storage.createUser({
    ...userData,
    password: hashedPassword
  });
  
  res.status(201).json({ success: true, user: { ...user, password: undefined } });
}));
```

---

## Data Fetching & Mutations

### Pattern 8: TanStack Query - Data Fetching

**Use Case:** Fetching data with caching and automatic refetching.

**Example: Fetching Notifications**

```tsx
import { useQuery } from "@tanstack/react-query";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function NotificationCenter() {
  const { data: notifications, isLoading, error } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    // queryFn is auto-configured in queryClient
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
  });

  if (isLoading) {
    return <div>Loading notifications...</div>;
  }

  if (error) {
    return <div>Error loading notifications: {error.message}</div>;
  }

  return (
    <div>
      {notifications?.map(notification => (
        <div key={notification.id}>
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  );
}
```

**With Query Parameters:**

```tsx
function AuditLogs() {
  const [action, setAction] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['/api/audit-logs', action, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (action) params.append('action', action);
      params.append('limit', pageSize.toString());
      params.append('offset', (page * pageSize).toString());
      
      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  return (
    <div>
      <select value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All Actions</option>
        <option value="login">Login</option>
        <option value="document_access">Document Access</option>
      </select>
      
      {/* Render audit logs */}
    </div>
  );
}
```

**Key Concepts:**
- `queryKey` array for cache identification (hierarchical keys for granular invalidation)
- `queryFn` for custom fetch logic (auto-configured by default)
- `staleTime` controls when data is considered fresh
- Query automatically refetches on mount if stale

---

### Pattern 9: TanStack Query - Mutations

**Use Case:** Modifying data with optimistic updates and cache invalidation.

**Example: Creating a Document Review**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function DocumentReviewForm({ documentId }: { documentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await fetch(`/api/document-review/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          verificationStatus: status,
          reviewNotes: notes
        })
      });
      
      if (!response.ok) throw new Error("Failed to update document status");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: ["/api/document-review/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", documentId] });
      
      toast({
        title: "Document Reviewed",
        description: "Document status has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (formData: { status: string; notes: string }) => {
    updateStatusMutation.mutate({
      id: documentId,
      status: formData.status,
      notes: formData.notes
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit({
        status: formData.get("status") as string,
        notes: formData.get("notes") as string
      });
    }}>
      <select name="status">
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <textarea name="notes" placeholder="Review notes" />
      <button type="submit" disabled={updateStatusMutation.isPending}>
        {updateStatusMutation.isPending ? "Saving..." : "Submit Review"}
      </button>
    </form>
  );
}
```

**Bulk Mutation Example:**

```tsx
const bulkUpdateMutation = useMutation({
  mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
    const response = await fetch('/api/document-review/bulk-update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        documentIds: ids,
        verificationStatus: status
      })
    });
    
    if (!response.ok) throw new Error("Failed to bulk update documents");
    return response.json();
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ["/api/document-review/queue"] });
    
    toast({
      title: "Bulk Update Complete",
      description: `Successfully updated ${data.updated} document(s).`
    });
  },
});
```

**Key Concepts:**
- `mutationFn` performs the mutation
- `onSuccess` invalidates related query caches
- `onError` handles error states
- `isPending` shows loading state
- Cache invalidation triggers automatic refetch

---

## Form Validation

### Pattern 10: React Hook Form with Zod

**Use Case:** Building type-safe forms with validation.

**Example: Login Form**

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  username: z.string().min(3, "Your username needs to be at least 3 characters"),
  password: z.string().min(6, "Your password needs to be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    console.log("Form data:", data);
    // API call here
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-username" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} data-testid="input-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full" data-testid="button-login">
          Login
        </Button>
      </form>
    </Form>
  );
}
```

**Complex Form with Custom Validation:**

```tsx
const signupSchema = z.object({
  username: z.string().min(3, "Your username needs to be at least 3 characters"),
  password: z.string().min(6, "Your password needs to be at least 6 characters"),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  fullName: z.string().optional(),
  role: z.enum(["client", "navigator", "caseworker", "admin"]).default("client"),
}).refine(data => {
  // Custom validation: If role is navigator, email is required
  if (data.role === "navigator" && !data.email) {
    return false;
  }
  return true;
}, {
  message: "Email is required for navigator accounts",
  path: ["email"], // Error shows on email field
});

type SignupFormData = z.infer<typeof signupSchema>;
```

---

## Authentication

### Pattern 11: Passport.js Local Strategy

**Use Case:** User authentication with sessions.

**Example: Auth Setup**

```ts
// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function setupAuth(app: Express) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find user by username
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username or password" });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
          return done(null, false, { message: "Incorrect username or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}
```

**Login/Logout Endpoints:**

```ts
app.post("/api/auth/login", (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ message: "Authentication error" });
    }
    
    if (!user) {
      return res.status(401).json({ message: info?.message || "Login failed" });
    }
    
    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ message: "Session error" });
      }
      
      // Don't send password to client
      const { password, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    });
  })(req, res, next);
});

app.post("/api/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ user: null });
  }
  
  const { password, ...userWithoutPassword } = req.user as any;
  res.json({ user: userWithoutPassword });
});
```

---

## Database Patterns

### Pattern 12: Drizzle ORM Queries

**Use Case:** Type-safe database queries.

**Example: Basic CRUD Operations**

```ts
import { db } from "./db";
import { documents, documentChunks } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// SELECT with WHERE clause
async function getDocumentById(id: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  
  return document;
}

// SELECT with JOIN
async function getDocumentWithChunks(documentId: string) {
  const result = await db
    .select({
      document: documents,
      chunk: documentChunks,
    })
    .from(documents)
    .leftJoin(documentChunks, eq(documentChunks.documentId, documents.id))
    .where(eq(documents.id, documentId));
  
  return result;
}

// INSERT
async function createDocument(data: {
  title: string;
  content: string;
  programId: string;
  uploadedBy: string;
}) {
  const [newDocument] = await db
    .insert(documents)
    .values({
      id: sql`gen_random_uuid()`,
      title: data.title,
      content: data.content,
      programId: data.programId,
      uploadedBy: data.uploadedBy,
      status: 'pending',
    })
    .returning();
  
  return newDocument;
}

// UPDATE
async function updateDocumentStatus(id: string, status: string) {
  const [updated] = await db
    .update(documents)
    .set({ 
      status,
      updatedAt: new Date() 
    })
    .where(eq(documents.id, id))
    .returning();
  
  return updated;
}

// DELETE with CASCADE
async function deleteDocument(id: string) {
  // Chunks are deleted automatically due to CASCADE foreign key
  await db
    .delete(documents)
    .where(eq(documents.id, id));
}

// COMPLEX QUERY with aggregation
async function getDocumentStats() {
  const stats = await db
    .select({
      programId: documents.programId,
      totalDocs: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where ${documents.status} = 'approved')`,
      pending: sql<number>`count(*) filter (where ${documents.status} = 'pending')`,
    })
    .from(documents)
    .groupBy(documents.programId);
  
  return stats;
}
```

**Vector Similarity Search:**

```ts
// Cosine similarity search for RAG
async function semanticSearch(queryEmbedding: number[], limit: number = 5) {
  const results = await db.execute(sql`
    SELECT 
      dc.id,
      dc.document_id,
      dc.chunk_text,
      dc.chunk_index,
      dc.start_char,
      dc.end_char,
      d.title,
      d.file_path,
      (1 - (dc.embedding <=> ${queryEmbedding}::vector)) as similarity_score
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `);
  
  return results.rows;
}
```

---

## AI Integration

### Pattern 13: Google Gemini RAG Pipeline

**Use Case:** Retrieval-Augmented Generation for policy queries.

**Example: Complete RAG Workflow**

```ts
// server/services/gemini.service.ts
import { GoogleGenerativeAI } from "@google/genai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class GeminiRAGService {
  private textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  private embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

  // Step 1: Generate query embedding
  async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.embeddingModel.embedContent(text);
    return result.embedding.values;
  }

  // Step 2: Retrieve relevant context (in routes.ts)
  async retrieveContext(queryEmbedding: number[], limit: number = 5) {
    const results = await db.execute(sql`
      SELECT 
        dc.chunk_text,
        d.title,
        d.file_path,
        (1 - (dc.embedding <=> ${queryEmbedding}::vector)) as similarity_score
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
        AND d.status = 'approved'
      ORDER BY dc.embedding <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    `);
    
    return results.rows;
  }

  // Step 3: Generate response with context
  async generateAnswer(query: string, context: any[]): Promise<{
    answer: string;
    citations: any[];
  }> {
    const contextText = context.map((c, i) => 
      `[${i + 1}] ${c.chunk_text}\nSource: ${c.title} (${c.file_path})`
    ).join("\n\n");

    const prompt = `You are a Maryland SNAP benefits expert. Answer the user's question based ONLY on the provided context.

Context:
${contextText}

User Question: ${query}

Instructions:
- Provide a clear, accurate answer based on the context
- Cite sources using [1], [2], etc.
- If the context doesn't contain the answer, say "I don't have enough information to answer that question"
- Use plain language suitable for benefit applicants

Answer:`;

    const result = await this.textModel.generateContent(prompt);
    const answer = result.response.text();

    const citations = context.map((c, i) => ({
      index: i + 1,
      title: c.title,
      filePath: c.file_path,
      similarityScore: c.similarity_score,
    }));

    return { answer, citations };
  }
}

// Usage in route
app.post("/api/chat/query", requireAuth, asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  // Step 1: Generate embedding
  const queryEmbedding = await ragService.generateEmbedding(query);
  
  // Step 2: Retrieve context
  const context = await ragService.retrieveContext(queryEmbedding, 5);
  
  // Step 3: Generate answer
  const { answer, citations } = await ragService.generateAnswer(query, context);
  
  res.json({ success: true, answer, citations });
}));
```

---

### Pattern 14: Document Processing Pipeline

**Use Case:** Multi-stage document ingestion with OCR, classification, and embedding.

**Example: Complete Pipeline**

```ts
// server/services/document-processing.service.ts
export class DocumentProcessingService {
  
  // Stage 1: OCR Extraction
  async extractText(filePath: string): Promise<string> {
    // Use Tesseract for OCR
    const text = await Tesseract.recognize(filePath, 'eng');
    return text.data.text;
  }

  // Stage 2: Document Classification
  async classifyDocument(text: string): Promise<{
    programId: string;
    documentType: string;
    confidence: number;
  }> {
    const prompt = `Classify this document. Determine:
1. Which benefit program it relates to (SNAP, Medicaid, TANF, etc.)
2. Document type (policy manual, notice, form, etc.)

Document text:
${text.substring(0, 2000)}

Respond with JSON: {"program": "...", "type": "...", "confidence": 0.0-1.0}`;

    const result = await geminiService.textModel.generateContent(prompt);
    return JSON.parse(result.response.text());
  }

  // Stage 3: Quality Assessment
  async assessQuality(text: string): Promise<{
    quality: 'high' | 'medium' | 'low';
    issues: string[];
  }> {
    const wordCount = text.split(/\s+/).length;
    const hasStructure = /section|chapter|article/i.test(text);
    const hasGarbage = /[^\x20-\x7E\n]/g.test(text);

    const issues: string[] = [];
    let quality: 'high' | 'medium' | 'low' = 'high';

    if (wordCount < 100) {
      issues.push("Low word count (< 100 words)");
      quality = 'low';
    }
    
    if (!hasStructure) {
      issues.push("Missing section structure");
      quality = quality === 'low' ? 'low' : 'medium';
    }
    
    if (hasGarbage) {
      issues.push("Contains non-ASCII characters");
    }

    return { quality, issues };
  }

  // Stage 4: Semantic Chunking
  async chunkDocument(text: string, documentId: string): Promise<{
    chunkText: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  }[]> {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: any[] = [];
    let currentChunk = "";
    let chunkIndex = 0;
    let startChar = 0;

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 1000) {
        chunks.push({
          chunkText: currentChunk.trim(),
          chunkIndex,
          startChar,
          endChar: startChar + currentChunk.length,
        });
        
        currentChunk = sentence;
        startChar += currentChunk.length;
        chunkIndex++;
      } else {
        currentChunk += " " + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        chunkText: currentChunk.trim(),
        chunkIndex,
        startChar,
        endChar: startChar + currentChunk.length,
      });
    }

    return chunks;
  }

  // Stage 5: Embedding Generation
  async generateChunkEmbeddings(chunks: any[]): Promise<any[]> {
    const chunksWithEmbeddings = [];

    for (const chunk of chunks) {
      const embedding = await geminiService.generateEmbedding(chunk.chunkText);
      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
      });
    }

    return chunksWithEmbeddings;
  }

  // Complete Pipeline
  async processDocument(filePath: string, uploadedBy: string): Promise<{
    documentId: string;
    status: string;
  }> {
    // Stage 1: Extract text
    const text = await this.extractText(filePath);

    // Stage 2: Classify
    const classification = await this.classifyDocument(text);

    // Stage 3: Quality check
    const qualityCheck = await this.assessQuality(text);

    // Create document record
    const [document] = await db
      .insert(documents)
      .values({
        id: sql`gen_random_uuid()`,
        title: classification.documentType,
        content: text,
        programId: classification.programId,
        uploadedBy,
        status: qualityCheck.quality === 'high' ? 'approved' : 'pending',
        filePath,
      })
      .returning();

    // Stage 4: Chunk document
    const chunks = await this.chunkDocument(text, document.id);

    // Stage 5: Generate embeddings
    const chunksWithEmbeddings = await this.generateChunkEmbeddings(chunks);

    // Stage 6: Store chunks
    await db.insert(documentChunks).values(
      chunksWithEmbeddings.map(chunk => ({
        id: sql`gen_random_uuid()`,
        documentId: document.id,
        chunkText: chunk.chunkText,
        chunkIndex: chunk.chunkIndex,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        embedding: chunk.embedding,
      }))
    );

    return {
      documentId: document.id,
      status: document.status,
    };
  }
}
```

---

## Error Handling

### Pattern 15: Centralized Error Handler

**Use Case:** Consistent error handling across all routes.

**Example: AsyncHandler Middleware**

```ts
// server/middleware/asyncHandler.ts
import { Request, Response, NextFunction } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);

  // Zod validation errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Validation error",
      errors: err.errors,
    });
  }

  // Database errors
  if (err.code === "23505") { // Unique constraint violation
    return res.status(409).json({
      message: "Resource already exists",
      detail: err.detail,
    });
  }

  // Authentication errors
  if (err.message === "Authentication required") {
    return res.status(401).json({ message: err.message });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});
```

---

## TypeScript Patterns

### Pattern 16: Shared Types and Schemas

**Use Case:** Type-safe data sharing between frontend and backend.

**Example: Shared Schema Definition**

```ts
// shared/schema.ts
import { pgTable, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Database table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("client"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().email().optional(),
});

export const selectUserSchema = createSelectSchema(users);

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
```

**Usage in Frontend:**

```tsx
import type { User } from "@shared/schema";

interface UserProfileProps {
  user: User;
}

function UserProfile({ user }: UserProfileProps) {
  return (
    <div>
      <h2>{user.fullName}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

**Usage in Backend:**

```ts
import { insertUserSchema, type User } from "@shared/schema";

app.post("/api/users", asyncHandler(async (req, res) => {
  const userData = insertUserSchema.parse(req.body);
  
  const [user]: User[] = await db
    .insert(users)
    .values(userData)
    .returning();
  
  res.json({ success: true, user });
}));
```

---

## Testing Patterns

### Pattern 17: Component Testing with React Testing Library

**Use Case:** Testing user interactions and component behavior.

**Example: Button Test**

```tsx
// Button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { describe, it, expect, vi } from "vitest";

describe("Button Component", () => {
  it("renders with correct text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies variant styles", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByText("Delete");
    expect(button).toHaveClass("bg-destructive");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });
});
```

**Form Test:**

```tsx
// LoginForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("shows validation errors for invalid input", async () => {
    render(<LoginForm />);
    
    const submitButton = screen.getByTestId("button-login");
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/username needs to be at least 3 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/password needs to be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} />);
    
    const user = userEvent.setup();
    
    await user.type(screen.getByTestId("input-username"), "johndoe");
    await user.type(screen.getByTestId("input-password"), "password123");
    await user.click(screen.getByTestId("button-login"));
    
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        username: "johndoe",
        password: "password123",
      });
    });
  });
});
```

---

### Pattern 18: API Integration Testing

**Use Case:** Testing API endpoints.

**Example: Supertest Integration**

```ts
// auth.test.ts
import request from "supertest";
import { app } from "../server";
import { describe, it, expect, beforeAll } from "vitest";

describe("Authentication API", () => {
  let authCookie: string;

  it("POST /api/auth/signup creates new user", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        username: "testuser",
        password: "password123",
        email: "test@example.com",
        fullName: "Test User",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user.username).toBe("testuser");
  });

  it("POST /api/auth/login authenticates user", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        username: "testuser",
        password: "password123",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.username).toBe("testuser");
    
    // Save session cookie
    authCookie = response.headers['set-cookie'][0];
  });

  it("GET /api/auth/me returns current user", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie);

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe("testuser");
  });

  it("POST /api/auth/logout logs out user", async () => {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", authCookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("GET /api/auth/me returns 401 after logout", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie);

    expect(response.status).toBe(401);
  });
});
```

---

## Best Practices

### Code Organization

1. **Component Structure:**
   ```
   client/src/
   ├── components/          # Reusable UI components
   │   ├── ui/             # shadcn/ui primitives
   │   └── custom/         # App-specific components
   ├── pages/              # Route components
   ├── hooks/              # Custom hooks
   ├── lib/                # Utilities and helpers
   └── types/              # TypeScript types
   ```

2. **API Structure:**
   ```
   server/
   ├── routes.ts           # API endpoints
   ├── storage.ts          # Data access layer
   ├── services/           # Business logic
   ├── middleware/         # Express middleware
   └── utils/              # Helper functions
   ```

3. **Shared Code:**
   ```
   shared/
   ├── schema.ts           # Database schema + Zod validation
   └── types.ts            # Shared TypeScript types
   ```

### Security Best Practices

1. **Never expose sensitive data:**
   ```ts
   // ❌ Bad
   res.json({ user });
   
   // ✅ Good
   const { password, ...userWithoutPassword } = user;
   res.json({ user: userWithoutPassword });
   ```

2. **Always validate input:**
   ```ts
   // ❌ Bad
   const user = await storage.createUser(req.body);
   
   // ✅ Good
   const userData = insertUserSchema.parse(req.body);
   const user = await storage.createUser(userData);
   ```

3. **Use parameterized queries:**
   ```ts
   // ❌ Bad (SQL injection risk)
   await db.execute(sql`SELECT * FROM users WHERE id = '${userId}'`);
   
   // ✅ Good
   await db.select().from(users).where(eq(users.id, userId));
   ```

### Performance Best Practices

1. **Optimize queries with indexes:**
   ```ts
   // Add indexes for frequently queried columns
   export const users = pgTable("users", {
     id: varchar("id").primaryKey(),
     username: varchar("username").notNull().unique(), // Index created automatically
     email: varchar("email"),
   }, (table) => ({
     emailIdx: index("email_idx").on(table.email), // Explicit index
   }));
   ```

2. **Use query result caching:**
   ```tsx
   // Cache query results for 5 minutes
   const { data } = useQuery({
     queryKey: ["/api/benefit-programs"],
     staleTime: 5 * 60 * 1000,
   });
   ```

3. **Lazy load heavy components:**
   ```tsx
   import { lazy, Suspense } from "react";
   
   const PolicyManual = lazy(() => import("@/pages/PolicyManual"));
   
   function App() {
     return (
       <Suspense fallback={<div>Loading...</div>}>
         <PolicyManual />
       </Suspense>
     );
   }
   ```

---

**Last Updated:** January 2025  
**Document Version:** 1.0

For code pattern questions, contact: dev-team@maryland.gov

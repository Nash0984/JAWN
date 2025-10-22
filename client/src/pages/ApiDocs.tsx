import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Code, Copy, CheckCircle2, Book, Shield, Database, Search, FileText, Users, Settings, Activity, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EndpointDoc {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  auth: "none" | "user" | "staff" | "admin";
  requestBody?: object;
  responseExample?: object;
  queryParams?: Array<{ name: string; type: string; required: boolean; description: string }>;
  pathParams?: Array<{ name: string; type: string; description: string }>;
  exampleCode?: {
    javascript?: string;
    python?: string;
    curl?: string;
  };
}

const API_CATEGORIES = {
  authentication: {
    title: "Authentication",
    icon: Shield,
    description: "User authentication and session management endpoints",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth/signup",
        title: "Sign Up",
        description: "Create a new user account",
        auth: "none",
        requestBody: {
          username: "string (3-50 chars)",
          email: "string (valid email)",
          password: "string (min 8 chars)",
          fullName: "string (optional)",
          role: "'user' | 'staff' | 'admin' (default: 'user')"
        },
        responseExample: {
          user: {
            id: "abc123",
            username: "johndoe",
            email: "john@example.com",
            role: "user"
          }
        },
        exampleCode: {
          javascript: `const response = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    password: 'SecurePass123',
    fullName: 'John Doe'
  })
});
const data = await response.json();`,
          python: `import requests

response = requests.post('https://your-domain.replit.app/api/auth/signup', 
  json={
    'username': 'johndoe',
    'email': 'john@example.com',
    'password': 'SecurePass123',
    'fullName': 'John Doe'
  }
)
data = response.json()`,
          curl: `curl -X POST https://your-domain.replit.app/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -d '{"username":"johndoe","email":"john@example.com","password":"SecurePass123","fullName":"John Doe"}'`
        }
      },
      {
        method: "POST",
        path: "/api/auth/login",
        title: "Log In",
        description: "Authenticate user and create session",
        auth: "none",
        requestBody: {
          username: "string",
          password: "string"
        },
        responseExample: {
          user: {
            id: "abc123",
            username: "johndoe",
            role: "user"
          }
        }
      },
      {
        method: "POST",
        path: "/api/auth/logout",
        title: "Log Out",
        description: "End current session",
        auth: "user",
        responseExample: {
          message: "Logged out successfully"
        }
      },
      {
        method: "GET",
        path: "/api/auth/me",
        title: "Get Current User",
        description: "Get authenticated user information",
        auth: "user",
        responseExample: {
          user: {
            id: "abc123",
            username: "johndoe",
            email: "john@example.com",
            role: "user"
          }
        }
      }
    ] as EndpointDoc[]
  },
  eligibility: {
    title: "Eligibility & Benefits",
    icon: Users,
    description: "Calculate SNAP eligibility and benefits using Rules Engine",
    endpoints: [
      {
        method: "POST",
        path: "/api/eligibility/check",
        title: "Quick Eligibility Check",
        description: "Determine if household is likely eligible for SNAP",
        auth: "user",
        requestBody: {
          householdSize: "number (1-20)",
          grossMonthlyIncome: "number (0-999999)",
          state: "string (default: 'MD')",
          hasDisabledOrElderly: "boolean (optional)"
        },
        responseExample: {
          eligible: true,
          reason: "Gross income below 200% FPL",
          grossIncomeLimit: 4086,
          netIncomeLimit: 2250,
          estimatedBenefit: 450,
          details: {
            grossIncomeTest: "PASS",
            netIncomeTest: "PASS"
          }
        },
        exampleCode: {
          javascript: `const response = await fetch('/api/eligibility/check', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Cookie': 'connect.sid=...' // Include session cookie
  },
  credentials: 'include',
  body: JSON.stringify({
    householdSize: 3,
    grossMonthlyIncome: 2500,
    hasDisabledOrElderly: false
  })
});
const eligibility = await response.json();`,
          python: `import requests

session = requests.Session()
# First login to get session
session.post('https://your-domain.replit.app/api/auth/login', 
  json={'username': 'user', 'password': 'pass'})

# Then check eligibility
response = session.post('https://your-domain.replit.app/api/eligibility/check',
  json={
    'householdSize': 3,
    'grossMonthlyIncome': 2500,
    'hasDisabledOrElderly': False
  }
)
eligibility = response.json()`
        }
      },
      {
        method: "POST",
        path: "/api/eligibility/calculate",
        title: "Full Benefit Calculation",
        description: "Calculate detailed SNAP benefits with all deductions",
        auth: "user",
        requestBody: {
          householdSize: "number",
          grossMonthlyIncome: "number",
          earnedIncome: "number",
          unearnedIncome: "number",
          rentOrMortgage: "number (optional)",
          utilities: "number (optional)",
          medicalExpenses: "number (optional)",
          dependentCareExpenses: "number (optional)",
          childSupportPaid: "number (optional)",
          hasDisabledOrElderly: "boolean (optional)",
          state: "string (default: 'MD')"
        },
        responseExample: {
          eligible: true,
          monthlyBenefit: 450,
          calculation: {
            grossIncome: 2500,
            earnedIncomeDeduction: 500,
            standardDeduction: 198,
            dependentCareDeduction: 200,
            excessShelterDeduction: 150,
            medicalDeduction: 100,
            netIncome: 1352,
            thirtyPercentOfNet: 405,
            maxAllotment: 855,
            finalBenefit: 450
          },
          limits: {
            grossIncomeLimit: 4086,
            netIncomeLimit: 2250,
            maxAllotment: 855
          }
        }
      },
      {
        method: "GET",
        path: "/api/eligibility/calculations",
        title: "Get Calculation History",
        description: "Retrieve user's past eligibility calculations",
        auth: "user",
        queryParams: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 50)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" }
        ],
        responseExample: {
          calculations: [
            {
              id: "calc123",
              createdAt: "2025-10-08T10:00:00Z",
              householdSize: 3,
              monthlyBenefit: 450,
              eligible: true
            }
          ],
          total: 1
        }
      }
    ] as EndpointDoc[]
  },
  search: {
    title: "Search & Chat",
    icon: Search,
    description: "RAG-powered semantic search and conversational AI",
    endpoints: [
      {
        method: "POST",
        path: "/api/search",
        title: "Hybrid Search",
        description: "Intelligent search routing between Rules Engine and RAG",
        auth: "user",
        requestBody: {
          query: "string (max 1000 chars)",
          benefitProgramId: "string (optional)",
          userId: "string (optional)"
        },
        responseExample: {
          answer: "The gross income limit for a household of 3 is $4,086/month (200% FPL).",
          type: "hybrid",
          classification: {
            isRulesQuery: true,
            confidence: 0.95,
            intent: "income_limit_inquiry"
          },
          citations: [
            {
              title: "SNAP Income Limits - Maryland",
              section: "Section 310: Income Eligibility Standards",
              page: 45
            }
          ],
          responseTime: 1250
        },
        exampleCode: {
          javascript: `const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Cookie': 'connect.sid=...'
  },
  credentials: 'include',
  body: JSON.stringify({
    query: 'What is the income limit for a family of 3?',
    benefitProgramId: 'maryland-snap'
  })
});
const result = await response.json();
// console.log(result.answer);
// console.log(result.citations);`
        }
      },
      {
        method: "POST",
        path: "/api/chat/ask",
        title: "Conversational Chat",
        description: "Context-aware AI chat for policy questions",
        auth: "user",
        requestBody: {
          query: "string (max 1000 chars)",
          context: "object (optional)",
          benefitProgramId: "string (optional)"
        },
        responseExample: {
          answer: "Based on the policy manual, you can report changes by...",
          citations: [
            {
              documentId: "doc123",
              title: "Reporting Changes",
              relevantChunk: "Recipients must report changes within 10 days..."
            }
          ],
          confidence: 0.92
        }
      }
    ] as EndpointDoc[]
  },
  rules: {
    title: "Rules Engine",
    icon: Database,
    description: "Access and manage Rules as Code for deterministic calculations",
    endpoints: [
      {
        method: "GET",
        path: "/api/rules/income-limits",
        title: "Get Income Limits",
        description: "Retrieve income eligibility limits",
        auth: "user",
        queryParams: [
          { name: "state", type: "string", required: false, description: "State code (default: MD)" },
          { name: "fiscalYear", type: "number", required: false, description: "Fiscal year" }
        ],
        responseExample: {
          incomeLimits: [
            {
              id: "limit1",
              householdSize: 1,
              grossMonthlyLimit: 2266,
              netMonthlyLimit: 1215,
              standardDeduction: 198,
              state: "MD",
              fiscalYear: 2025
            }
          ]
        }
      },
      {
        method: "POST",
        path: "/api/rules/income-limits",
        title: "Create Income Limit",
        description: "Add new income limit rule (admin only)",
        auth: "admin",
        requestBody: {
          householdSize: "number",
          grossMonthlyLimit: "number",
          netMonthlyLimit: "number",
          standardDeduction: "number",
          state: "string (default: 'MD')",
          fiscalYear: "number"
        }
      },
      {
        method: "GET",
        path: "/api/rules/deductions",
        title: "Get Deductions",
        description: "Retrieve standard deductions and rules",
        auth: "user",
        responseExample: {
          deductions: [
            {
              id: "ded1",
              deductionType: "standard",
              householdSize: 3,
              amount: 198,
              description: "Standard deduction for households 1-3"
            }
          ]
        }
      },
      {
        method: "GET",
        path: "/api/rules/allotments",
        title: "Get Benefit Allotments",
        description: "Retrieve maximum benefit allotment tables",
        auth: "user",
        responseExample: {
          allotments: [
            {
              id: "allot1",
              householdSize: 3,
              maxMonthlyBenefit: 855,
              fiscalYear: 2025
            }
          ]
        }
      },
      {
        method: "GET",
        path: "/api/rules/categorical-eligibility",
        title: "Get Categorical Eligibility",
        description: "Retrieve broad-based categorical eligibility rules",
        auth: "user"
      },
      {
        method: "GET",
        path: "/api/rules/document-requirements",
        title: "Get Document Requirements",
        description: "Retrieve required verification documents",
        auth: "user"
      }
    ] as EndpointDoc[]
  },
  documents: {
    title: "Documents",
    icon: FileText,
    description: "Document upload, processing, and verification",
    endpoints: [
      {
        method: "POST",
        path: "/api/verify-document",
        title: "Verify Document",
        description: "AI-powered document verification using Gemini Vision",
        auth: "user",
        requestBody: {
          document: "File (multipart/form-data)",
          documentType: "string",
          metadata: "object (optional)"
        },
        responseExample: {
          verified: true,
          documentType: "PAYSTUB",
          extractedData: {
            employerName: "ACME Corp",
            grossPay: 2500,
            payPeriod: "2024-09-01 to 2024-09-15",
            netPay: 1850
          },
          confidence: 0.94,
          issues: [],
          recommendations: []
        },
        exampleCode: {
          javascript: `const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('documentType', 'PAYSTUB');

const response = await fetch('/api/verify-document', {
  method: 'POST',
  credentials: 'include',
  body: formData
});
const verification = await response.json();`
        }
      },
      {
        method: "POST",
        path: "/api/documents/upload",
        title: "Upload Policy Document",
        description: "Upload and process policy document (admin only)",
        auth: "admin",
        requestBody: {
          file: "File (multipart/form-data)",
          title: "string",
          benefitProgramId: "string",
          policySourceId: "string (optional)"
        }
      },
      {
        method: "GET",
        path: "/api/documents",
        title: "List Documents",
        description: "Get all policy documents (admin only)",
        auth: "admin",
        queryParams: [
          { name: "limit", type: "number", required: false, description: "Max results" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" }
        ]
      },
      {
        method: "GET",
        path: "/api/documents/:id",
        title: "Get Document",
        description: "Get specific document details (admin only)",
        auth: "admin",
        pathParams: [
          { name: "id", type: "string", description: "Document ID" }
        ]
      }
    ] as EndpointDoc[]
  },
  navigator: {
    title: "Navigator Workspace",
    icon: Users,
    description: "Benefits navigator tools and E&E export integration",
    endpoints: [
      {
        method: "GET",
        path: "/api/navigator/sessions",
        title: "Get Navigator Sessions",
        description: "Retrieve client interaction sessions",
        auth: "staff",
        responseExample: {
          sessions: [
            {
              id: "session1",
              clientName: "Jane Smith",
              sessionDate: "2025-10-08",
              duration: 45,
              outcome: "APPLICATION_SUBMITTED",
              notes: "Assisted with SNAP application"
            }
          ]
        }
      },
      {
        method: "POST",
        path: "/api/navigator/sessions",
        title: "Create Session",
        description: "Log new client interaction session",
        auth: "staff",
        requestBody: {
          clientName: "string",
          sessionDate: "string (ISO date)",
          duration: "number (minutes)",
          outcome: "string",
          notes: "string (optional)"
        }
      },
      {
        method: "POST",
        path: "/api/navigator/exports",
        title: "Create E&E Export",
        description: "Generate batch export for DHS E&E system integration",
        auth: "staff",
        requestBody: {
          format: "'csv' | 'json' | 'xml'",
          startDate: "string (ISO date)",
          endDate: "string (ISO date)",
          includeDocuments: "boolean (optional)"
        },
        responseExample: {
          exportId: "export123",
          status: "processing",
          format: "csv",
          recordCount: 150,
          downloadUrl: "/api/navigator/exports/export123/download"
        },
        exampleCode: {
          javascript: `// Create export for DHS E&E system
const response = await fetch('/api/navigator/exports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    format: 'csv',
    startDate: '2025-10-01',
    endDate: '2025-10-08',
    includeDocuments: true
  })
});
const exportJob = await response.json();

// Download when ready
const downloadUrl = exportJob.downloadUrl;
window.location.href = downloadUrl;`,
          python: `import requests

session = requests.Session()
session.post('https://your-domain.replit.app/api/auth/login',
  json={'username': 'staff', 'password': 'pass'})

# Create export
response = session.post('https://your-domain.replit.app/api/navigator/exports',
  json={
    'format': 'csv',
    'startDate': '2025-10-01',
    'endDate': '2025-10-08',
    'includeDocuments': True
  }
)
export_job = response.json()

# Download
download_response = session.get(
  f'https://your-domain.replit.app{export_job["downloadUrl"]}'
)
with open('export.csv', 'wb') as f:
  f.write(download_response.content)`
        }
      },
      {
        method: "GET",
        path: "/api/navigator/exports/:id/download",
        title: "Download Export",
        description: "Download generated E&E export file",
        auth: "staff",
        pathParams: [
          { name: "id", type: "string", description: "Export ID" }
        ]
      }
    ] as EndpointDoc[]
  },
  monitoring: {
    title: "AI Monitoring",
    icon: Activity,
    description: "AI health metrics, bias detection, and quality monitoring",
    endpoints: [
      {
        method: "GET",
        path: "/api/ai-monitoring/query-analytics",
        title: "Query Analytics",
        description: "Get search query patterns and trends",
        auth: "user",
        queryParams: [
          { name: "timeRange", type: "string", required: false, description: "'7d' | '30d' | '90d'" }
        ],
        responseExample: {
          totalQueries: 1250,
          avgResponseTime: 850,
          topQueries: [
            { query: "income limits", count: 45 }
          ],
          queryTrends: [
            { date: "2025-10-01", count: 120 }
          ]
        }
      },
      {
        method: "GET",
        path: "/api/ai-monitoring/system-health",
        title: "System Health",
        description: "AI system health and performance metrics",
        auth: "user"
      },
      {
        method: "GET",
        path: "/api/ai-monitoring/response-quality",
        title: "Response Quality",
        description: "AI response quality metrics and bias detection",
        auth: "user"
      },
      {
        method: "POST",
        path: "/api/ai-monitoring/flag-response",
        title: "Flag Response",
        description: "Report problematic AI response for review",
        auth: "user",
        requestBody: {
          queryId: "string",
          reason: "string",
          details: "string (optional)"
        }
      }
    ] as EndpointDoc[]
  },
  audit: {
    title: "Audit & Compliance",
    icon: Shield,
    description: "Audit logs and compliance tracking",
    endpoints: [
      {
        method: "GET",
        path: "/api/audit-logs",
        title: "Get Audit Logs",
        description: "Retrieve system audit logs (admin only)",
        auth: "admin",
        queryParams: [
          { name: "action", type: "string", required: false, description: "Filter by action type" },
          { name: "entityType", type: "string", required: false, description: "Filter by entity" },
          { name: "startDate", type: "string", required: false, description: "ISO date" },
          { name: "endDate", type: "string", required: false, description: "ISO date" },
          { name: "limit", type: "number", required: false, description: "Max results (default: 50)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" }
        ],
        responseExample: {
          logs: [
            {
              id: "log1",
              action: "LOGIN",
              userId: "user123",
              username: "johndoe",
              entityType: "user",
              timestamp: "2025-10-08T10:00:00Z",
              ipAddress: "192.168.1.1",
              metadata: { userAgent: "Mozilla/5.0..." }
            }
          ],
          total: 1
        }
      },
      {
        method: "GET",
        path: "/api/rule-change-logs",
        title: "Get Rule Change Logs",
        description: "Retrieve rules modification history (admin only)",
        auth: "admin",
        queryParams: [
          { name: "tableName", type: "string", required: false, description: "Filter by rule table" },
          { name: "changeType", type: "string", required: false, description: "CREATE|UPDATE|DELETE" },
          { name: "limit", type: "number", required: false, description: "Max results (default: 50)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" }
        ]
      }
    ] as EndpointDoc[]
  },
  system: {
    title: "System",
    icon: Settings,
    description: "Health checks and system status",
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        title: "Health Check",
        description: "Comprehensive system health status",
        auth: "none",
        responseExample: {
          status: "healthy",
          timestamp: "2025-10-08T10:00:00Z",
          uptime: 86400,
          services: {
            database: { status: "healthy", latency: "5ms" },
            geminiApi: { status: "healthy", configured: true },
            objectStorage: { status: "healthy", configured: true }
          },
          system: {
            memory: { used: 512, total: 1024, unit: "MB" },
            nodeVersion: "v18.0.0",
            environment: "production"
          }
        },
        exampleCode: {
          javascript: `// No authentication required
const response = await fetch('/api/health');
const health = await response.json();
// console.log('Status:', health.status);
// console.log('Database:', health.services.database.status);`,
          curl: `curl https://your-domain.replit.app/api/health`
        }
      },
      {
        method: "GET",
        path: "/api/system/status",
        title: "System Status",
        description: "Detailed system metrics (admin only)",
        auth: "admin"
      },
      {
        method: "GET",
        path: "/api/benefit-programs",
        title: "Get Benefit Programs",
        description: "List available benefit programs",
        auth: "none",
        responseExample: {
          programs: [
            {
              id: "maryland-snap",
              name: "Maryland SNAP",
              state: "MD",
              description: "Food Supplement Program"
            }
          ]
        }
      },
      {
        method: "GET",
        path: "/api/document-types",
        title: "Get Document Types",
        description: "List supported verification document types",
        auth: "none",
        responseExample: {
          documentTypes: [
            { id: "PAYSTUB", name: "Pay Stub", description: "Income verification" },
            { id: "BANK_STATEMENT", name: "Bank Statement", description: "Asset verification" }
          ]
        }
      }
    ] as EndpointDoc[]
  }
};

export default function ApiDocs() {
  const [activeCategory, setActiveCategory] = useState("authentication");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast({
      title: "Copied to clipboard",
      description: "Code example copied successfully",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getAuthBadgeColor = (auth: string) => {
    switch (auth) {
      case "none": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "user": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "staff": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "POST": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "PUT": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "PATCH": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const renderEndpoint = (endpoint: EndpointDoc, index: number) => {
    return (
      <AccordionItem key={index} value={`endpoint-${index}`}>
        <AccordionTrigger 
          className="hover:no-underline"
          data-testid={`button-expand-${endpoint.path.replace(/\//g, '-')}`}
        >
          <div className="flex items-center gap-3 flex-1 text-left">
            <Badge 
              className={`${getMethodBadgeColor(endpoint.method)} font-mono text-xs min-w-[60px] justify-center`}
              data-testid={`badge-method-${endpoint.method}`}
            >
              {endpoint.method}
            </Badge>
            <code className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {endpoint.path}
            </code>
            <Badge 
              className={`${getAuthBadgeColor(endpoint.auth)} text-xs ml-auto`}
              data-testid={`badge-auth-${endpoint.auth}`}
            >
              {endpoint.auth === "none" ? "Public" : endpoint.auth.toUpperCase()}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {endpoint.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {endpoint.description}
              </p>
            </div>

            {endpoint.pathParams && (
              <div>
                <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                  Path Parameters
                </h5>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-1">
                  {endpoint.pathParams.map((param, i) => (
                    <div key={i} className="text-sm">
                      <code className="text-blue-600 dark:text-blue-400">{param.name}</code>
                      <span className="text-gray-600 dark:text-gray-400 mx-2">•</span>
                      <span className="text-gray-600 dark:text-gray-400">{param.type}</span>
                      <span className="text-gray-600 dark:text-gray-400 mx-2">•</span>
                      <span className="text-gray-600 dark:text-gray-400">{param.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.queryParams && (
              <div>
                <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                  Query Parameters
                </h5>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-1">
                  {endpoint.queryParams.map((param, i) => (
                    <div key={i} className="text-sm">
                      <code className="text-blue-600 dark:text-blue-400">{param.name}</code>
                      <span className="text-gray-600 dark:text-gray-400 mx-2">•</span>
                      <span className="text-gray-600 dark:text-gray-400">{param.type}</span>
                      {param.required && (
                        <Badge className="ml-2 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Required
                        </Badge>
                      )}
                      <p className="text-gray-600 dark:text-gray-400 mt-1 ml-4">
                        {param.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {endpoint.requestBody && (
              <div>
                <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                  Request Body
                </h5>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm overflow-x-auto">
                  <code className="text-gray-800 dark:text-gray-200">
                    {JSON.stringify(endpoint.requestBody, null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {endpoint.responseExample && (
              <div>
                <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                  Response Example
                </h5>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded p-3 text-sm overflow-x-auto">
                  <code className="text-gray-800 dark:text-gray-200">
                    {JSON.stringify(endpoint.responseExample, null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {endpoint.exampleCode && (
              <div>
                <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                  Code Examples
                </h5>
                <Tabs defaultValue="javascript" className="w-full">
                  <TabsList className="grid w-full grid-cols-3" data-testid="tabs-code-examples">
                    {endpoint.exampleCode.javascript && (
                      <TabsTrigger value="javascript" data-testid="tab-javascript">JavaScript</TabsTrigger>
                    )}
                    {endpoint.exampleCode.python && (
                      <TabsTrigger value="python" data-testid="tab-python">Python</TabsTrigger>
                    )}
                    {endpoint.exampleCode.curl && (
                      <TabsTrigger value="curl" data-testid="tab-curl">cURL</TabsTrigger>
                    )}
                  </TabsList>
                  {endpoint.exampleCode.javascript && (
                    <TabsContent value="javascript">
                      <div className="relative">
                        <pre className="bg-gray-900 dark:bg-black rounded p-4 text-sm overflow-x-auto">
                          <code className="text-green-400">
                            {endpoint.exampleCode.javascript}
                          </code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(endpoint.exampleCode!.javascript!, `${endpoint.path}-js`)}
                          data-testid="button-copy-javascript"
                        >
                          {copiedCode === `${endpoint.path}-js` ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                  {endpoint.exampleCode.python && (
                    <TabsContent value="python">
                      <div className="relative">
                        <pre className="bg-gray-900 dark:bg-black rounded p-4 text-sm overflow-x-auto">
                          <code className="text-green-400">
                            {endpoint.exampleCode.python}
                          </code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(endpoint.exampleCode!.python!, `${endpoint.path}-py`)}
                          data-testid="button-copy-python"
                        >
                          {copiedCode === `${endpoint.path}-py` ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                  {endpoint.exampleCode.curl && (
                    <TabsContent value="curl">
                      <div className="relative">
                        <pre className="bg-gray-900 dark:bg-black rounded p-4 text-sm overflow-x-auto">
                          <code className="text-green-400">
                            {endpoint.exampleCode.curl}
                          </code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(endpoint.exampleCode!.curl!, `${endpoint.path}-curl`)}
                          data-testid="button-copy-curl"
                        >
                          {copiedCode === `${endpoint.path}-curl` ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const category = API_CATEGORIES[activeCategory as keyof typeof API_CATEGORIES];
  const CategoryIcon = category.icon;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          API Documentation
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete API reference for Maryland Universal Benefits-Tax Navigator integration
        </p>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Book className="h-5 w-5" />
            DHS Integration Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-blue-800 dark:text-blue-200">
          <p>
            <strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">https://your-domain.replit.app</code>
          </p>
          <p>
            <strong>Authentication:</strong> Session-based with cookies. Use <code>/api/auth/login</code> to establish a session.
          </p>
          <p>
            <strong>E&E Export:</strong> Use <code>/api/navigator/exports</code> to generate batch exports in CSV, JSON, or XML format for E&E system integration.
          </p>
          <p>
            <strong>Rate Limits:</strong> No enforced limits in development. Contact admin for production limits.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            API Categories
          </h2>
          {Object.entries(API_CATEGORIES).map(([key, cat]) => {
            const Icon = cat.icon;
            return (
              <Button
                key={key}
                variant={activeCategory === key ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setActiveCategory(key)}
                data-testid={`button-category-${key}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {cat.title}
              </Button>
            );
          })}
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className="h-5 w-5" />
                {category.title}
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {category.endpoints.map((endpoint, index) => renderEndpoint(endpoint, index))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

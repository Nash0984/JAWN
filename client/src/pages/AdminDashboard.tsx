import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, FileText, Database, Upload, Users, Shield, RefreshCw, BookOpen, Activity, Code } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  const adminActions = [
    {
      title: "Document Management",
      description: "Upload and manage policy documents",
      icon: FileText,
      href: "/admin/documents",
      testId: "action-documents",
      primary: true,
    },
    {
      title: "Policy Sources",
      description: "Configure automated policy ingestion",
      icon: RefreshCw,
      href: "/admin/sources",
      testId: "action-sources",
      primary: true,
    },
    {
      title: "Rules Management",
      description: "Update income limits, deductions, and rules",
      icon: Database,
      href: "/admin/rules",
      testId: "action-rules",
      primary: true,
    },
    {
      title: "AI Monitoring",
      description: "View AI health, bias indicators, and analytics",
      icon: Activity,
      href: "/admin/ai-monitoring",
      testId: "action-ai-monitoring",
      primary: true,
    },
    {
      title: "Audit Logs",
      description: "View system activity and rule changes",
      icon: Shield,
      href: "/admin/audit-logs",
      testId: "action-audit-logs",
      primary: true,
    },
    {
      title: "API Documentation",
      description: "Integration guide for DHS E&E systems",
      icon: Code,
      href: "/admin/api-docs",
      testId: "action-api-docs",
      primary: true,
    },
    {
      title: "AI Training",
      description: "Train and manage AI models",
      icon: Settings,
      href: "/admin/training",
      testId: "action-training",
    },
    {
      title: "User Management",
      description: "Manage system users and roles",
      icon: Users,
      href: "/admin/users",
      testId: "action-users",
    },
    {
      title: "System Settings",
      description: "Configure system-wide settings",
      icon: Settings,
      href: "/admin/settings",
      testId: "action-settings",
    },
  ];

  const staffTools = [
    {
      title: "Document Verification",
      description: "Verify client documents",
      icon: Shield,
      href: "/verify",
      testId: "tool-verify",
    },
    {
      title: "Policy Manual",
      description: "Browse policy documentation",
      icon: BookOpen,
      href: "/manual",
      testId: "tool-manual",
    },
    {
      title: "Client Sessions",
      description: "View client interactions",
      icon: Users,
      href: "/navigator",
      testId: "tool-sessions",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          System Administration
        </h1>
        <p className="text-muted-foreground">
          Welcome{user?.fullName ? `, ${user.fullName}` : ""}
          {user?.dhsEmployeeId && ` • Employee ID: ${user.dhsEmployeeId}`}
        </p>
      </div>

      {/* Admin Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Administrative Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card 
                key={action.href} 
                className={`hover:shadow-lg transition-shadow ${action.primary ? 'border-primary/50' : ''}`}
                data-testid={action.testId}
              >
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${action.primary ? 'bg-primary text-primary-foreground' : 'bg-primary/10'}`}>
                      <Icon className={`h-6 w-6 ${action.primary ? '' : 'text-primary'}`} />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant={action.primary ? "default" : "outline"}>
                    <Link href={action.href}>
                      Manage {action.title}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Staff Tools */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Staff Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {staffTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card key={tool.href} className="hover:shadow-lg transition-shadow" data-testid={tool.testId}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={tool.href}>
                      Access {tool.title}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Information */}
      <Card data-testid="system-info">
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Maryland SNAP Policy Manual System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Document Processing</h3>
            <p className="text-sm text-muted-foreground">
              The system uses Google Gemini AI for document analysis, OCR, and semantic search.
              Policy documents are automatically ingested from official Maryland DHS sources.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Rules as Code</h3>
            <p className="text-sm text-muted-foreground">
              Eligibility calculations are based on codified rules from COMAR Title 10 and 7 CFR Part 273.
              Update these rules through the Rules Management interface to ensure accurate benefit determinations.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Integration Status</h3>
            <p className="text-sm text-muted-foreground">
              The system is designed to integrate with marylandbenefits.gov for SSO and the Maryland DHS
              Eligibility & Enrollment (E&E) system for case data exchange.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

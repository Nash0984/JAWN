import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Shield, FileCheck, Search, Calculator, BookOpen, FileText } from "lucide-react";

export default function CaseworkerDashboard() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Client Sessions",
      description: "Review and manage client cases",
      icon: Users,
      href: "/navigator",
      testId: "action-sessions",
      primary: true,
    },
    {
      title: "Document Verification",
      description: "Verify and process client documents",
      icon: FileCheck,
      href: "/verify",
      testId: "action-verify",
      primary: true,
    },
    {
      title: "Eligibility Calculator",
      description: "Calculate SNAP eligibility and benefits",
      icon: Calculator,
      href: "/eligibility",
      testId: "action-eligibility",
      primary: true,
    },
    {
      title: "Consent Forms",
      description: "Manage client consent documentation",
      icon: Shield,
      href: "/consent",
      testId: "action-consent",
    },
    {
      title: "Policy Search",
      description: "Find policy guidance and regulations",
      icon: Search,
      href: "/search",
      testId: "action-search",
    },
    {
      title: "Policy Manual",
      description: "Access complete SNAP policy manual",
      icon: BookOpen,
      href: "/manual",
      testId: "action-manual",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          Caseworker Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome{user?.fullName ? `, ${user.fullName}` : ""}
          {user?.dhsEmployeeId && ` • Employee ID: ${user.dhsEmployeeId}`}
          {user?.officeLocation && ` • ${user.officeLocation}`}
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action) => {
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
                    Open {action.title}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Caseworker Resources */}
      <Card data-testid="resources-section">
        <CardHeader>
          <CardTitle>DHS Caseworker Resources</CardTitle>
          <CardDescription>Tools and guidance for SNAP case management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Case Processing Workflow</h3>
            <p className="text-sm text-muted-foreground">
              Use the document verification tool to validate client submissions, the eligibility calculator
              to determine benefit amounts, and the session tracker to maintain comprehensive case notes.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Policy Compliance</h3>
            <p className="text-sm text-muted-foreground">
              All eligibility determinations are based on current Maryland SNAP policies (COMAR Title 10)
              and federal regulations (7 CFR Part 273). Use the policy search tool to verify specific requirements.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">E&E System Integration</h3>
            <p className="text-sm text-muted-foreground">
              Client interaction data can be exported to the Maryland DHS Eligibility & Enrollment system
              for official case management and benefit issuance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

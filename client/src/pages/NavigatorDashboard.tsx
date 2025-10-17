import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Shield, FileCheck, Search, Calculator, BookOpen, ClipboardCheck } from "lucide-react";

export default function NavigatorDashboard() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Client Sessions",
      description: "Track and manage client interactions",
      icon: Users,
      href: "/navigator",
      testId: "action-sessions",
      primary: true,
    },
    {
      title: "Document Review Queue",
      description: "Review and approve client verification documents",
      icon: ClipboardCheck,
      href: "/navigator/document-review",
      testId: "action-document-review",
      primary: true,
    },
    {
      title: "Document Verification",
      description: "Verify client documents with AI assistance",
      icon: FileCheck,
      href: "/verify",
      testId: "action-verify",
      primary: true,
    },
    {
      title: "Consent Forms",
      description: "Manage client consent forms",
      icon: Shield,
      href: "/consent",
      testId: "action-consent",
    },
    {
      title: "Eligibility Check",
      description: "Calculate SNAP eligibility for clients",
      icon: Calculator,
      href: "/eligibility",
      testId: "action-eligibility",
    },
    {
      title: "Policy Search",
      description: "Find policy answers quickly",
      icon: Search,
      href: "/search",
      testId: "action-search",
    },
    {
      title: "Policy Manual",
      description: "Browse complete policy documentation",
      icon: BookOpen,
      href: "/manual",
      testId: "action-manual",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Navigator Dashboard - MD Benefits Navigator</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="dashboard-title">
          Navigator Workspace
        </h1>
        <p className="text-muted-foreground">
          Welcome{user?.fullName ? `, ${user.fullName}` : ""}
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

      {/* Tips Section */}
      <Card data-testid="tips-section">
        <CardHeader>
          <CardTitle>Navigator Tips</CardTitle>
          <CardDescription>Best practices for assisting SNAP applicants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Document Verification</h3>
            <p className="text-sm text-muted-foreground">
              Use the AI-powered document verification tool to quickly validate client documents.
              The system will highlight any issues and provide policy citations.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Session Tracking</h3>
            <p className="text-sm text-muted-foreground">
              Log all client interactions in the Navigator Workspace to maintain accurate records
              and generate reports for the E&E system.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Consent Management</h3>
            <p className="text-sm text-muted-foreground">
              Ensure all clients have signed appropriate consent forms before accessing or sharing
              their information with other agencies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}

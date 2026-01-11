import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Shield, FileCheck, Search, Calculator, BookOpen, ClipboardCheck, ArrowRight, Sparkles } from "lucide-react";
import { LDSSOfficeInfo } from "@/components/LDSSOfficeInfo";
import { useTenant } from "@/contexts/TenantContext";

export default function NavigatorDashboard() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Client Sessions",
      description: "Track and manage client interactions",
      icon: Users,
      href: "/navigator",
      testId: "action-sessions",
      primary: true,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Document Review Queue",
      description: "Review and approve client verification documents",
      icon: ClipboardCheck,
      href: "/navigator/document-review",
      testId: "action-document-review",
      primary: true,
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      title: "Document Verification",
      description: "Verify client documents with AI assistance",
      icon: FileCheck,
      href: "/verify",
      testId: "action-verify",
      primary: true,
      gradient: "from-violet-500 to-violet-600",
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
        <title>Navigator Dashboard - {stateName} Benefits Navigator</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Welcome Header with Gradient */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="dashboard-title">
                Navigator Workspace
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Welcome back{user?.fullName ? `, ${user.fullName}` : ""}
              {user?.officeLocation && (
                <span className="inline-flex items-center ml-2 px-2 py-0.5 rounded-full bg-muted text-sm">
                  {user.officeLocation}
                </span>
              )}
            </p>
          </div>

          {/* LDSS Office Information */}
          <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <LDSSOfficeInfo />
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={action.href} 
                  className={`group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-slide-up ${action.primary ? 'ring-1 ring-primary/20' : ''}`}
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  data-testid={action.testId}
                >
                  {action.primary && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                        action.primary 
                          ? `bg-gradient-to-br ${action.gradient} text-white shadow-md group-hover:shadow-lg group-hover:scale-110` 
                          : 'bg-muted group-hover:bg-primary/10'
                      }`}>
                        <Icon className={`h-5 w-5 ${action.primary ? '' : 'text-primary'}`} />
                      </div>
                      <CardTitle className="text-lg font-semibold">{action.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button 
                      asChild 
                      className={`w-full group/btn transition-all duration-200 ${action.primary ? 'shadow-md hover:shadow-lg' : ''}`} 
                      variant={action.primary ? "default" : "outline"}
                    >
                      <Link href={action.href} className="flex items-center justify-center gap-2">
                        Open
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tips Section */}
          <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-lg animate-slide-up" style={{ animationDelay: '0.4s' }} data-testid="tips-section">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/20 text-secondary-foreground">
                  <BookOpen className="h-4 w-4" />
                </span>
                Navigator Tips
              </CardTitle>
              <CardDescription>Best practices for assisting SNAP applicants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-background/60 border border-border/50 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Document Verification</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the AI-powered document verification tool to quickly validate client documents.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-background/60 border border-border/50 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Session Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Log all client interactions in the Navigator Workspace to maintain accurate records.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-background/60 border border-border/50 hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
                    <Shield className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Consent Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Ensure all clients have signed appropriate consent forms before sharing their information.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, FileText, Search, HelpCircle, BookOpen } from "lucide-react";

export default function ClientDashboard() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Check Eligibility",
      description: "See if you qualify for SNAP benefits",
      icon: Calculator,
      href: "/eligibility",
      testId: "action-eligibility",
    },
    {
      title: "Search Policies",
      description: "Find answers to your questions about SNAP",
      icon: Search,
      href: "/search",
      testId: "action-search",
    },
    {
      title: "Policy Manual",
      description: "Browse the full Maryland SNAP policy manual",
      icon: BookOpen,
      href: "/manual",
      testId: "action-manual",
    },
    {
      title: "Get Help",
      description: "Find resources and contact information",
      icon: HelpCircle,
      href: "/help",
      testId: "action-help",
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
          Access information about Maryland's Food Supplement Program (SNAP)
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                  <Link href={action.href}>
                    Go to {action.title}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Information Section */}
      <Card data-testid="info-section">
        <CardHeader>
          <CardTitle>About Maryland SNAP</CardTitle>
          <CardDescription>Food Supplement Program Information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">What is SNAP?</h3>
            <p className="text-sm text-muted-foreground">
              The Supplemental Nutrition Assistance Program (SNAP), known as the Food Supplement Program in Maryland,
              helps eligible low-income individuals and families buy the food they need for good health.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">How to Use This System</h3>
            <p className="text-sm text-muted-foreground">
              Use the tools above to check your eligibility, search for policy information, or find help with your benefits.
              All information is based on official Maryland Department of Human Services policies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

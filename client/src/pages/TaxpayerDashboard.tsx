import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, PenTool, Calendar, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DeadlineIndicator } from "@/components/taxpayer/DeadlineIndicator";
import { useTenant } from "@/contexts/TenantContext";

export default function TaxpayerDashboard() {
  const { user } = useAuth();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';

  // Fetch all taxpayer-related data
  const { data: documentRequests, isLoading: loadingRequests } = useQuery<any[]>({
    queryKey: ["/api/taxpayer/document-requests"],
  });

  const { data: messages, isLoading: loadingMessages } = useQuery<any[]>({
    queryKey: ["/api/taxpayer/messages", "all"],
  });

  const { data: signatures, isLoading: loadingSignatures } = useQuery<any[]>({
    queryKey: ["/api/taxpayer/esignatures"],
  });

  // Calculate counts
  const pendingDocuments = documentRequests?.filter(req => req.status === "pending").length || 0;
  const unreadMessages = messages?.filter(msg => !msg.isRead && msg.senderRole === "navigator").length || 0;
  const pendingSignatures = signatures?.filter(sig => !sig.isValid).length || 0;

  // Get upcoming deadlines
  const upcomingDeadlines = documentRequests
    ?.filter(req => req.status === "pending" && req.dueDate)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3) || [];

  const quickActions = [
    {
      title: "Upload Documents",
      description: `${pendingDocuments} document${pendingDocuments !== 1 ? 's' : ''} requested`,
      icon: FileText,
      href: "/taxpayer/documents",
      testId: "action-upload-documents",
      badge: pendingDocuments > 0 ? pendingDocuments : null,
      variant: "default" as const,
    },
    {
      title: "Check Messages",
      description: `${unreadMessages} unread message${unreadMessages !== 1 ? 's' : ''}`,
      icon: MessageSquare,
      href: "/taxpayer/messages",
      testId: "action-check-messages",
      badge: unreadMessages > 0 ? unreadMessages : null,
      variant: "secondary" as const,
    },
    {
      title: "Sign Forms",
      description: `${pendingSignatures} form${pendingSignatures !== 1 ? 's' : ''} pending signature`,
      icon: PenTool,
      href: "/taxpayer/signature",
      testId: "action-sign-forms",
      badge: pendingSignatures > 0 ? pendingSignatures : null,
      variant: "outline" as const,
    },
  ];

  return (
    <>
      <Helmet>
        <title>My Tax Portal - Dashboard | {stateName} Benefits</title>
        <meta name="description" content="Access your tax preparation documents, messages, and forms in one secure portal." />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2" data-testid="dashboard-title">
            My Tax Portal
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Welcome back{user?.fullName ? `, ${user.fullName}` : ""}! Manage your tax preparation documents and communications.
          </p>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-documents-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground dark:text-foreground">Document Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground dark:text-foreground" data-testid="count-pending-documents">
                    {pendingDocuments}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    {pendingDocuments === 0 ? "All caught up!" : "Documents needed"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-messages-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground dark:text-foreground">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {loadingMessages ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground dark:text-foreground" data-testid="count-unread-messages">
                    {unreadMessages}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    {unreadMessages === 0 ? "No new messages" : "Unread messages"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-signatures-status">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground dark:text-foreground">E-Signatures</CardTitle>
              <PenTool className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {loadingSignatures ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground dark:text-foreground" data-testid="count-pending-signatures">
                    {pendingSignatures}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    {pendingSignatures === 0 ? "All signed" : "Pending signatures"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground dark:text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.href}
                  className="hover:shadow-lg transition-all bg-card dark:bg-card border-border dark:border-border"
                  data-testid={action.testId}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                          <Icon className="h-6 w-6 text-primary dark:text-primary" aria-hidden="true" />
                        </div>
                        <CardTitle className="text-lg text-foreground dark:text-foreground">{action.title}</CardTitle>
                      </div>
                      {action.badge && action.badge > 0 && (
                        <Badge variant="destructive" data-testid={`badge-${action.testId}`}>
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full" variant={action.variant}>
                      <Link href={action.href}>
                        <span>Open</span>
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        {upcomingDeadlines.length > 0 && (
          <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-upcoming-deadlines">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary dark:text-primary" aria-hidden="true" />
                <CardTitle className="text-foreground dark:text-foreground">Upcoming Deadlines</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                Documents needed soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingDeadlines.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border dark:border-border bg-muted/30 dark:bg-muted/10"
                    data-testid={`deadline-item-${request.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground dark:text-foreground" data-testid={`text-request-name-${request.id}`}>
                        {request.documentName}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                        {request.description}
                      </p>
                    </div>
                    <DeadlineIndicator dueDate={request.dueDate} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-8 bg-muted/30 dark:bg-muted/10 border-border dark:border-border" data-testid="card-help-section">
          <CardHeader>
            <CardTitle className="text-foreground dark:text-foreground">Need Help?</CardTitle>
            <CardDescription className="text-muted-foreground dark:text-muted-foreground">
              Contact your tax navigator for assistance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
              If you have questions about the documents requested or need help uploading files,
              send a message to your navigator through the messaging center.
            </p>
            <Button asChild variant="outline" data-testid="button-contact-navigator">
              <Link href="/taxpayer/messages">
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                Contact Navigator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, CheckCircle, AlertCircle, FileText, Calendar, TrendingUp } from "lucide-react";
import { format, differenceInDays, differenceInHours, parseISO } from "date-fns";
import SupervisorReviewModal from "@/components/SupervisorReviewModal";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { BenefitsAccessReview } from "@shared/schema";

interface ReviewStats {
  totalAssigned: number;
  pending: number;
  completedThisWeek: number;
  averageReviewTime: number;
}

interface UpcomingCheckpoint {
  id: string;
  reviewId: string;
  checkpointName: string;
  checkpointType: string;
  dueDate: string;
  caseId: string;
  status: string;
}

export default function SupervisorReviewDashboard() {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [pendingCount, setPendingCount] = useState(0);
  const { subscribe } = useWebSocket();

  // Fetch review statistics
  const { data: stats, isLoading: statsLoading } = useQuery<ReviewStats>({
    queryKey: ["/api/bar/stats"],
  });

  // Fetch reviews based on status filter
  const { data: reviews, isLoading: reviewsLoading, refetch } = useQuery<BenefitsAccessReview[]>({
    queryKey: ["/api/bar/reviews", statusFilter],
  });

  // Fetch upcoming checkpoints
  const { data: checkpoints, isLoading: checkpointsLoading } = useQuery<UpcomingCheckpoint[]>({
    queryKey: ["/api/bar/checkpoints/upcoming"],
  });

  // Subscribe to WebSocket BAR review events for real-time updates
  useState(() => {
    const unsubscribe = subscribe("bar_review_assigned", (data) => {
      setPendingCount((prev) => prev + 1);
      refetch();
    });

    const unsubscribeComplete = subscribe("bar_review_completed", () => {
      setPendingCount((prev) => Math.max(0, prev - 1));
      refetch();
    });

    return () => {
      unsubscribe();
      unsubscribeComplete();
    };
  });

  // Update pending count when stats load
  useState(() => {
    if (stats?.pending) {
      setPendingCount(stats.pending);
    }
  });

  // Get urgency styling for review rows
  const getUrgencyStyle = (dueDate: string) => {
    const hoursUntilDue = differenceInHours(parseISO(dueDate), new Date());
    if (hoursUntilDue < 24) {
      return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
    }
    if (hoursUntilDue < 72) {
      return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
    }
    return "";
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">Pending</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-950">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter reviews by status
  const filteredReviews = reviews?.filter((review) => {
    if (statusFilter === "active") {
      return review.reviewStatus === "pending" || review.reviewStatus === "in_progress";
    }
    if (statusFilter === "all") {
      return true;
    }
    return review.reviewStatus === statusFilter;
  }) || [];

  const selectedReview = reviews?.find(r => r.id === selectedReviewId);

  return (
    <>
      <Helmet>
        <title>Case Review Dashboard - MD Benefits Navigator</title>
      </Helmet>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">
                Case Review Dashboard
              </h1>
              <p className="text-muted-foreground text-lg" data-testid="page-subtitle">
                Benefits Access Review - Quality Monitoring
              </p>
            </div>
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="text-lg px-4 py-2" 
                data-testid="badge-pending-reviews"
              >
                {pendingCount} Pending Review{pendingCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stat-total-assigned">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Assigned Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats?.totalAssigned || 0}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card 
            data-testid="stat-pending" 
            className={pendingCount > 0 ? "border-orange-500 dark:border-orange-700" : ""}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${pendingCount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
                  <span className={`text-2xl font-bold ${pendingCount > 0 ? 'text-orange-600' : ''}`}>
                    {pendingCount}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="stat-completed-week">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-2xl font-bold">{stats?.completedThisWeek || 0}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="stat-avg-time">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Review Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {stats?.averageReviewTime ? `${Math.round(stats.averageReviewTime)}m` : '--'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reviews Table - Takes 2 columns */}
          <Card className="lg:col-span-2" data-testid="reviews-panel">
            <CardHeader>
              <CardTitle>Assigned Reviews</CardTitle>
              <CardDescription>
                Cases requiring supervisor review and feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Status Filter Tabs */}
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
                <TabsList>
                  <TabsTrigger value="active" data-testid="filter-active">Active</TabsTrigger>
                  <TabsTrigger value="pending" data-testid="filter-pending">Pending</TabsTrigger>
                  <TabsTrigger value="in_progress" data-testid="filter-in-progress">In Progress</TabsTrigger>
                  <TabsTrigger value="completed" data-testid="filter-completed">Completed</TabsTrigger>
                  <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Reviews Table */}
              {reviewsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredReviews.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  iconColor="green"
                  title="No reviews found"
                  description={`No ${statusFilter === 'active' ? 'active' : statusFilter} reviews at this time.`}
                  data-testid="empty-state-reviews"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-reviews">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Review ID</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>Review Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReviews.map((review) => {
                        const daysUntilDue = differenceInDays(
                          parseISO(review.reviewPeriodEnd),
                          new Date()
                        );
                        
                        return (
                          <TableRow
                            key={review.id}
                            className={getUrgencyStyle(review.reviewPeriodEnd)}
                            data-testid={`review-row-${review.id}`}
                          >
                            <TableCell className="font-mono text-sm" data-testid={`review-id-${review.id}`}>
                              {review.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell data-testid={`review-program-${review.id}`}>
                              SNAP
                            </TableCell>
                            <TableCell data-testid={`review-county-${review.id}`}>
                              {review.caseId?.substring(0, 10) || 'N/A'}
                            </TableCell>
                            <TableCell data-testid={`review-due-${review.id}`}>
                              <div className="flex flex-col">
                                <span>{format(parseISO(review.reviewPeriodEnd), 'MMM d, yyyy')}</span>
                                <span className={`text-xs ${daysUntilDue < 1 ? 'text-red-600' : daysUntilDue < 3 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                  {daysUntilDue < 0 ? 'Overdue' : `${daysUntilDue} days left`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell data-testid={`review-status-${review.id}`}>
                              {getStatusBadge(review.reviewStatus)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setSelectedReviewId(review.id)}
                                data-testid={`button-review-case-${review.id}`}
                              >
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Checkpoints Panel */}
          <Card data-testid="checkpoints-panel">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <CardTitle>Upcoming Checkpoints</CardTitle>
              </div>
              <CardDescription>
                Next 10 case lifecycle events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checkpointsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !checkpoints || checkpoints.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No upcoming checkpoints"
                  description="All checkpoints are up to date."
                  data-testid="empty-state-checkpoints"
                />
              ) : (
                <div className="space-y-3">
                  {checkpoints.slice(0, 10).map((checkpoint) => {
                    const daysUntil = differenceInDays(parseISO(checkpoint.dueDate), new Date());
                    
                    return (
                      <div
                        key={checkpoint.id}
                        className="border rounded-lg p-3 hover:bg-accent transition-colors cursor-pointer"
                        onClick={() => setSelectedReviewId(checkpoint.reviewId)}
                        data-testid={`checkpoint-${checkpoint.id}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-sm">{checkpoint.checkpointName}</span>
                          <Badge variant="outline" className="text-xs">
                            {checkpoint.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{format(parseISO(checkpoint.dueDate), 'MMM d, yyyy')}</span>
                          <span className={daysUntil < 3 ? 'text-orange-600 font-medium' : ''}>
                            ({daysUntil} days)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mandatory Review Modal */}
      {selectedReview && (
        <SupervisorReviewModal
          review={selectedReview}
          isOpen={!!selectedReviewId}
          onClose={() => setSelectedReviewId(null)}
        />
      )}
    </>
  );
}

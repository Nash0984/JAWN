import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  AlertCircle,
  Download,
  RotateCcw,
  TrendingUp,
  FileCheck
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface EFileMetrics {
  statusCounts: { status: string; count: number; federal: number; maryland: number }[];
  errorRate: number;
  recentActivity: { date: string; transmitted: number; accepted: number; rejected: number }[];
  totalSubmissions: number;
  pendingRetries: number;
}

interface EFileSubmission {
  id: string;
  clientName: string;
  taxYear: number;
  federalStatus: string;
  marylandStatus?: string;
  federalTransmissionId?: string;
  marylandTransmissionId?: string;
  preparerName: string;
  submittedAt?: Date;
  updatedAt: Date;
  hasErrors: boolean;
}

interface EFileSubmissionDetails {
  federal: {
    id: string;
    taxYear: number;
    filingStatus: string;
    efileStatus: string;
    efileTransmissionId?: string;
    efileSubmittedAt?: Date;
    efileAcceptedAt?: Date;
    efileRejectionReason?: string;
    validationErrors?: any;
    qualityReview?: any;
    form1040Data: any;
  };
  maryland?: {
    id: string;
    efileStatus: string;
    efileTransmissionId?: string;
    efileSubmittedAt?: Date;
    efileAcceptedAt?: Date;
    form502Data: any;
  };
  preparer: {
    id: string;
    username: string;
    fullName?: string;
  };
  reviewer?: {
    id: string;
    username: string;
    fullName?: string;
  };
  scenario?: {
    id: string;
    scenarioName: string;
  };
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    ready: "default",
    transmitted: "outline",
    accepted: "default",
    rejected: "destructive",
  };
  
  const colors: Record<string, string> = {
    draft: "text-gray-600",
    ready: "text-blue-600",
    transmitted: "text-blue-500",
    accepted: "text-green-600",
    rejected: "text-red-600",
  };

  return (
    <Badge variant={variants[status] || "secondary"} className={colors[status]}>
      {status === "transmitted" && <Send className="h-3 w-3 mr-1" />}
      {status === "accepted" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
      {status === "ready" && <FileCheck className="h-3 w-3 mr-1" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

export default function EFileMonitoring() {
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useQuery<EFileMetrics>({
    queryKey: ['/api/admin/efile/metrics'],
  });

  const { data: submissionsData, isLoading: submissionsLoading, error: submissionsError, refetch: refetchSubmissions } = useQuery<{
    submissions: EFileSubmission[];
    total: number;
  }>({
    queryKey: statusFilter === "all" 
      ? ['/api/admin/efile/submissions'] 
      : ['/api/admin/efile/submissions', { status: statusFilter }],
  });

  const { data: submissionDetails, isLoading: detailsLoading } = useQuery<EFileSubmissionDetails>({
    queryKey: [`/api/admin/efile/submission/${selectedSubmission}`],
    enabled: !!selectedSubmission,
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/efile/retry/${id}`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Retry initiated",
        description: "The submission has been reset to ready status for retry.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/efile/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/efile/metrics'] });
      setSelectedSubmission(null);
    },
    onError: (error: any) => {
      toast({
        title: "Retry failed",
        description: error.message || "Failed to retry submission. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRetry = (id: string) => {
    if (confirm("Are you sure you want to retry this submission? This will reset it to ready status.")) {
      retryMutation.mutate(id);
    }
  };

  const handleRefresh = () => {
    refetchMetrics();
    refetchSubmissions();
  };

  if (metricsLoading || submissionsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">E-File Monitoring</h1>
            <p className="text-muted-foreground">Track tax return e-file submissions and statuses</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (metricsError || submissionsError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load E-File monitoring data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics || !submissionsData) {
    return null;
  }

  const statusCounts = metrics.statusCounts.reduce((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="efile-monitoring-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">E-File Monitoring</h1>
          <p className="text-muted-foreground">Track tax return e-file submissions and statuses</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="card-total-submissions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-submissions">
              {metrics.totalSubmissions}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card data-testid="card-transmitted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transmitted</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-transmitted">
              {statusCounts['transmitted'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sent to IRS/MD</p>
          </CardContent>
        </Card>

        <Card data-testid="card-accepted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-accepted">
              {statusCounts['accepted'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Successfully filed</p>
          </CardContent>
        </Card>

        <Card data-testid="card-rejected">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-rejected">
              {statusCounts['rejected'] || 0}
            </div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-error-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-error-rate">
              {metrics.errorRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Rejection rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="submissions" data-testid="tab-submissions">Submissions</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">Error Logs</TabsTrigger>
        </TabsList>

        {/* Submissions Tab */}
        <TabsContent value="submissions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>E-File Submissions</CardTitle>
                  <CardDescription>Filter and view all tax return e-file submissions</CardDescription>
                </div>
                <div className="flex gap-2">
                  <select 
                    className="border rounded-md px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    data-testid="select-status-filter"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="transmitted">Transmitted</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Tax Year</TableHead>
                    <TableHead>Federal Status</TableHead>
                    <TableHead>Maryland Status</TableHead>
                    <TableHead>Transmission ID</TableHead>
                    <TableHead>Preparer</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissionsData.submissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No submissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissionsData.submissions.map((submission) => (
                      <TableRow key={submission.id} data-testid={`row-submission-${submission.id}`}>
                        <TableCell className="font-medium">{submission.clientName}</TableCell>
                        <TableCell>{submission.taxYear}</TableCell>
                        <TableCell>{getStatusBadge(submission.federalStatus)}</TableCell>
                        <TableCell>
                          {submission.marylandStatus ? getStatusBadge(submission.marylandStatus) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {submission.federalTransmissionId || '-'}
                        </TableCell>
                        <TableCell>{submission.preparerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {submission.updatedAt ? format(new Date(submission.updatedAt), 'MMM d, yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedSubmission(submission.id)}
                              data-testid={`button-view-${submission.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {submission.federalStatus === 'rejected' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRetry(submission.id)}
                                disabled={retryMutation.isPending}
                                data-testid={`button-retry-${submission.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity (Last 7 Days)</CardTitle>
              <CardDescription>E-file transmission trends</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.recentActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.recentActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="transmitted" stroke="#3b82f6" name="Transmitted" />
                    <Line type="monotone" dataKey="accepted" stroke="#22c55e" name="Accepted" />
                    <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Rejected" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No recent activity data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
              <CardDescription>Current submission status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.statusCounts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="federal" fill="#3b82f6" name="Federal" />
                  <Bar dataKey="maryland" fill="#f59e0b" name="Maryland" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Logs Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Submissions</CardTitle>
              <CardDescription>Submissions that failed validation or were rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Tax Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error Details</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissionsData.submissions
                    .filter(s => s.federalStatus === 'rejected')
                    .map((submission) => (
                      <TableRow key={submission.id} data-testid={`error-row-${submission.id}`}>
                        <TableCell className="font-medium">{submission.clientName}</TableCell>
                        <TableCell>{submission.taxYear}</TableCell>
                        <TableCell>{getStatusBadge(submission.federalStatus)}</TableCell>
                        <TableCell>
                          {submission.hasErrors ? (
                            <Badge variant="destructive">Has Errors</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No details</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {submission.updatedAt ? format(new Date(submission.updatedAt), 'MMM d, yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedSubmission(submission.id)}
                              data-testid={`button-view-error-${submission.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRetry(submission.id)}
                              disabled={retryMutation.isPending}
                              data-testid={`button-retry-error-${submission.id}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {submissionsData.submissions.filter(s => s.federalStatus === 'rejected').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No rejected submissions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submission Details Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-submission-details">
          <DialogHeader>
            <DialogTitle>E-File Submission Details</DialogTitle>
            <DialogDescription>
              Detailed information about the tax return submission
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : submissionDetails ? (
            <div className="space-y-6">
              {/* Federal Return */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Federal Return (Form 1040)
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tax Year:</span>
                    <span className="ml-2 font-medium">{submissionDetails.federal.taxYear}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filing Status:</span>
                    <span className="ml-2 font-medium">{submissionDetails.federal.filingStatus}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-File Status:</span>
                    <span className="ml-2">{getStatusBadge(submissionDetails.federal.efileStatus)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transmission ID:</span>
                    <span className="ml-2 font-mono text-xs">{submissionDetails.federal.efileTransmissionId || 'N/A'}</span>
                  </div>
                  {submissionDetails.federal.efileSubmittedAt && (
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="ml-2">{format(new Date(submissionDetails.federal.efileSubmittedAt), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  )}
                  {submissionDetails.federal.efileAcceptedAt && (
                    <div>
                      <span className="text-muted-foreground">Accepted:</span>
                      <span className="ml-2">{format(new Date(submissionDetails.federal.efileAcceptedAt), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  )}
                </div>
                
                {submissionDetails.federal.efileRejectionReason && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Rejection Reason:</strong> {submissionDetails.federal.efileRejectionReason}
                    </AlertDescription>
                  </Alert>
                )}

                {submissionDetails.federal.validationErrors && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2">Validation Errors:</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(submissionDetails.federal.validationErrors, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Maryland Return */}
              {submissionDetails.maryland && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Maryland Return (Form 502)
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">E-File Status:</span>
                      <span className="ml-2">{getStatusBadge(submissionDetails.maryland.efileStatus)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Transmission ID:</span>
                      <span className="ml-2 font-mono text-xs">{submissionDetails.maryland.efileTransmissionId || 'N/A'}</span>
                    </div>
                    {submissionDetails.maryland.efileSubmittedAt && (
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>
                        <span className="ml-2">{format(new Date(submissionDetails.maryland.efileSubmittedAt), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    )}
                    {submissionDetails.maryland.efileAcceptedAt && (
                      <div>
                        <span className="text-muted-foreground">Accepted:</span>
                        <span className="ml-2">{format(new Date(submissionDetails.maryland.efileAcceptedAt), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preparer Info */}
              <div>
                <h3 className="font-semibold mb-3">Preparer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Preparer:</span>
                    <span className="ml-2 font-medium">
                      {submissionDetails.preparer.fullName || submissionDetails.preparer.username}
                    </span>
                  </div>
                  {submissionDetails.reviewer && (
                    <div>
                      <span className="text-muted-foreground">Reviewer:</span>
                      <span className="ml-2 font-medium">
                        {submissionDetails.reviewer.fullName || submissionDetails.reviewer.username}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Review */}
              {submissionDetails.federal.qualityReview && (
                <div>
                  <h3 className="font-semibold mb-3">Quality Review Notes</h3>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(submissionDetails.federal.qualityReview, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {submissionDetails.federal.efileStatus === 'rejected' && (
                  <Button 
                    variant="default" 
                    onClick={() => handleRetry(submissionDetails.federal.id)}
                    disabled={retryMutation.isPending}
                    data-testid="button-retry-dialog"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Submission
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Submission details not found
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LoadingWrapper } from "@/components/common";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Filter, AlertCircle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistance } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Feedback {
  id: string;
  userId: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  feedbackType: string;
  category: string;
  severity: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  pageUrl: string | null;
  title: string;
  description: string;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  screenshotUrl: string | null;
  status: string;
  priority: string | null;
  assignedTo: string | null;
  adminNotes: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  submitterUsername: string | null;
  assignedToUsername: string | null;
  resolvedByUsername: string | null;
}

export default function FeedbackManagement() {
  const { toast } = useToast();
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Expanded feedback details
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set());
  
  // Selected feedback for update
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updatePriority, setUpdatePriority] = useState("");
  const [updateAssignedTo, setUpdateAssignedTo] = useState("");
  const [updateAdminNotes, setUpdateAdminNotes] = useState("");
  const [updateResolution, setUpdateResolution] = useState("");
  
  const toggleFeedback = (id: string) => {
    const newExpanded = new Set(expandedFeedback);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFeedback(newExpanded);
  };

  // Fetch feedback with filters
  const { data: feedbackData, isLoading } = useQuery({
    queryKey: ['/api/feedback', statusFilter, typeFilter, categoryFilter, severityFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('feedbackType', typeFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (severityFilter) params.append('severity', severityFilter);
      params.append('limit', pageSize.toString());
      params.append('offset', (page * pageSize).toString());
      
      const response = await fetch(`/api/feedback?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch feedback');
      return response.json();
    }
  });

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await apiRequest(`/api/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      toast({
        title: "Feedback updated",
        description: "The feedback has been updated successfully",
      });
      setSelectedFeedback(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update feedback",
        variant: "destructive",
      });
    }
  });

  const handleUpdateFeedback = () => {
    if (!selectedFeedback) return;
    
    const updates: any = {};
    if (updateStatus) updates.status = updateStatus;
    if (updatePriority) updates.priority = updatePriority;
    if (updateAssignedTo) updates.assignedTo = updateAssignedTo;
    if (updateAdminNotes) updates.adminNotes = updateAdminNotes;
    if (updateResolution) updates.resolution = updateResolution;
    
    updateFeedbackMutation.mutate({ id: selectedFeedback.id, updates });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      wont_fix: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    return colors[status] || colors.submitted;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    };
    return colors[severity] || colors.medium;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted": return <Clock className="h-4 w-4" />;
      case "under_review": return <AlertCircle className="h-4 w-4" />;
      case "resolved": return <CheckCircle2 className="h-4 w-4" />;
      case "closed": return <CheckCircle2 className="h-4 w-4" />;
      case "wont_fix": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Feedback Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and manage user feedback on AI responses, eligibility results, and policy content
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter feedback by status, type, category, and severity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="type-filter">Feedback Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type-filter" data-testid="select-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="ai_response">AI Response</SelectItem>
                  <SelectItem value="eligibility_result">Eligibility Result</SelectItem>
                  <SelectItem value="policy_content">Policy Content</SelectItem>
                  <SelectItem value="document_verification">Document Verification</SelectItem>
                  <SelectItem value="system_issue">System Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category-filter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter" data-testid="select-category-filter">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value="incorrect_answer">Incorrect Answer</SelectItem>
                  <SelectItem value="missing_info">Missing Information</SelectItem>
                  <SelectItem value="confusing">Confusing</SelectItem>
                  <SelectItem value="technical_error">Technical Error</SelectItem>
                  <SelectItem value="bias_concern">Bias Concern</SelectItem>
                  <SelectItem value="accessibility_issue">Accessibility Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="severity-filter">Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger id="severity-filter" data-testid="select-severity-filter">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("");
                setTypeFilter("");
                setCategoryFilter("");
                setSeverityFilter("");
                setPage(0);
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback Submissions ({feedbackData?.total || 0})
          </CardTitle>
          <CardDescription>
            Review and respond to user feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingWrapper isLoading={isLoading} skeletonType="list" skeletonCount={3}>
            {feedbackData?.feedbacks?.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No feedback submissions found</p>
              </div>
            ) : (
              <>
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackData?.feedbacks?.map((feedback: Feedback) => (
                    <>
                      <TableRow key={feedback.id}>
                        <TableCell>
                          <button
                            onClick={() => toggleFeedback(feedback.id)}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            aria-expanded={expandedFeedback.has(feedback.id)}
                            data-testid={`button-expand-${feedback.id}`}
                          >
                            {expandedFeedback.has(feedback.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDistance(new Date(feedback.createdAt), new Date(), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="font-medium max-w-md truncate">
                          {feedback.title}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">
                            {feedback.feedbackType.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">
                            {feedback.category.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSeverityBadge(feedback.severity)}>
                            {feedback.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusBadge(feedback.status)} flex items-center gap-1 w-fit`}>
                            {getStatusIcon(feedback.status)}
                            {feedback.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {feedback.submitterUsername || feedback.submitterName || 'Anonymous'}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedFeedback(feedback);
                                  setUpdateStatus(feedback.status);
                                  setUpdatePriority(feedback.priority || "");
                                  setUpdateAssignedTo(feedback.assignedTo || "");
                                  setUpdateAdminNotes(feedback.adminNotes || "");
                                  setUpdateResolution(feedback.resolution || "");
                                }}
                                data-testid={`button-update-${feedback.id}`}
                              >
                                Update
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Update Feedback</DialogTitle>
                                <DialogDescription>
                                  Change status, assign, or resolve this feedback
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="update-status">Status</Label>
                                  <Select value={updateStatus} onValueChange={setUpdateStatus}>
                                    <SelectTrigger id="update-status" data-testid="select-update-status">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="submitted">Submitted</SelectItem>
                                      <SelectItem value="under_review">Under Review</SelectItem>
                                      <SelectItem value="resolved">Resolved</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                      <SelectItem value="wont_fix">Won't Fix</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label htmlFor="update-priority">Priority</Label>
                                  <Select value={updatePriority} onValueChange={setUpdatePriority}>
                                    <SelectTrigger id="update-priority" data-testid="select-update-priority">
                                      <SelectValue placeholder="Set priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label htmlFor="update-admin-notes">Admin Notes</Label>
                                  <Textarea
                                    id="update-admin-notes"
                                    value={updateAdminNotes}
                                    onChange={(e) => setUpdateAdminNotes(e.target.value)}
                                    placeholder="Internal notes about this feedback..."
                                    rows={3}
                                    data-testid="textarea-admin-notes"
                                  />
                                </div>
                                
                                <div>
                                  <Label htmlFor="update-resolution">Resolution</Label>
                                  <Textarea
                                    id="update-resolution"
                                    value={updateResolution}
                                    onChange={(e) => setUpdateResolution(e.target.value)}
                                    placeholder="How was this resolved..."
                                    rows={3}
                                    data-testid="textarea-resolution"
                                  />
                                </div>
                                
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    onClick={handleUpdateFeedback}
                                    disabled={updateFeedbackMutation.isPending}
                                    data-testid="button-save-update"
                                  >
                                    {updateFeedbackMutation.isPending ? "Saving..." : "Save Changes"}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                      
                      {expandedFeedback.has(feedback.id) && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-gray-50 dark:bg-gray-900">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {feedback.description}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Expected Behavior
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {feedback.expectedBehavior || 'Not provided'}
                                  </p>
                                </div>
                              </div>
                              
                              {feedback.actualBehavior && (
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Actual Behavior
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {feedback.actualBehavior}
                                  </p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Page URL:</span>
                                  <p className="text-gray-600 dark:text-gray-400 truncate">{feedback.pageUrl || 'Not provided'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Related Entity:</span>
                                  <p className="text-gray-600 dark:text-gray-400">
                                    {feedback.relatedEntityType ? `${feedback.relatedEntityType}: ${feedback.relatedEntityId}` : 'None'}
                                  </p>
                                </div>
                              </div>
                              
                              {feedback.adminNotes && (
                                <div className="border-t pt-4">
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Admin Notes
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {feedback.adminNotes}
                                  </p>
                                </div>
                              )}
                              
                              {feedback.resolution && (
                                <div className="border-t pt-4">
                                  <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                    Resolution
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {feedback.resolution}
                                  </p>
                                  {feedback.resolvedAt && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                      Resolved {formatDistance(new Date(feedback.resolvedAt), new Date(), { addSuffix: true })}
                                      {feedback.resolvedByUsername && ` by ${feedback.resolvedByUsername}`}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, feedbackData?.total || 0)} of {feedbackData?.total || 0}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= (feedbackData?.total || 0)}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
              </>
            )}
          </LoadingWrapper>
        </CardContent>
      </Card>
    </div>
  );
}

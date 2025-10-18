import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Check, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentSyncJob } from "@shared/schema";

interface SyncJobReviewTableProps {
  jobs: ContentSyncJob[];
  onPreview: (job: ContentSyncJob) => void;
}

export function SyncJobReviewTable({ jobs, onPreview }: SyncJobReviewTableProps) {
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ContentSyncJob | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async ({ jobId, action, notes }: { jobId: string; action: 'approve' | 'reject'; notes?: string }) => {
      return await apiRequest(`/api/content-sync/jobs/${jobId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ action, notes }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-sync/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/content-analytics'] });
      
      toast({
        title: `Job ${variables.action}ed`,
        description: `Sync job has been ${variables.action}ed successfully`,
      });

      // If approved, also apply the changes
      if (variables.action === 'approve') {
        applyMutation.mutate(variables.jobId);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to review sync job",
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest(`/api/content-sync/jobs/${jobId}/apply`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/templates'] });
      toast({
        title: "Changes Applied",
        description: "Template has been updated with the new content",
      });
    },
  });

  const handleApprove = (job: ContentSyncJob) => {
    reviewMutation.mutate({ jobId: job.id, action: 'approve' });
  };

  const handleRejectClick = (job: ContentSyncJob) => {
    setSelectedJob(job);
    setRejectionNotes("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedJob) {
      reviewMutation.mutate({
        jobId: selectedJob.id,
        action: 'reject',
        notes: rejectionNotes,
      });
      setRejectDialogOpen(false);
      setSelectedJob(null);
      setRejectionNotes("");
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
      pending: { variant: "secondary", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
      approved: { variant: "default", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
      rejected: { variant: "destructive", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
      failed: { variant: "destructive", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    };

    const config = variants[status] || variants.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {status}
      </Badge>
    );
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12" data-testid="sync-jobs-empty">
        <p className="text-muted-foreground">No sync jobs found</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="header-content-type">Content Type</TableHead>
              <TableHead data-testid="header-rac-change">RaC Change</TableHead>
              <TableHead data-testid="header-status">Status</TableHead>
              <TableHead data-testid="header-queued-at">Queued At</TableHead>
              <TableHead className="text-right" data-testid="header-actions">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} data-testid={`sync-job-row-${job.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium capitalize" data-testid={`job-content-type-${job.id}`}>
                      {job.contentType?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`job-content-id-${job.id}`}>
                      ID: {job.contentId.substring(0, 8)}...
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm" data-testid={`job-rac-table-${job.id}`}>
                      {job.racTableName}
                    </p>
                    {job.racFieldName && (
                      <p className="text-xs text-muted-foreground" data-testid={`job-rac-field-${job.id}`}>
                        Field: {job.racFieldName}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell data-testid={`job-status-${job.id}`}>
                  {getStatusBadge(job.status)}
                </TableCell>
                <TableCell data-testid={`job-queued-at-${job.id}`}>
                  {formatDate(job.queuedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPreview(job)}
                      data-testid={`button-preview-${job.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    {job.status === 'pending' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(job)}
                          disabled={reviewMutation.isPending}
                          data-testid={`button-approve-${job.id}`}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRejectClick(job)}
                          disabled={reviewMutation.isPending}
                          data-testid={`button-reject-${job.id}`}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="reject-dialog">
          <DialogHeader>
            <DialogTitle>Reject Sync Job</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this sync job. This will help improve future content generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-notes">Rejection Notes</Label>
              <Textarea
                id="rejection-notes"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explain why this change should be rejected..."
                rows={4}
                data-testid="input-rejection-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionNotes.trim() || reviewMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

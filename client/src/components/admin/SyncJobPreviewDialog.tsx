import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { ContentSyncJob } from "@shared/schema";

interface SyncJobPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ContentSyncJob | null;
}

export function SyncJobPreviewDialog({ open, onOpenChange, job }: SyncJobPreviewDialogProps) {
  if (!job) return null;

  const formatValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="sync-job-preview-dialog">
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Content Change Preview</DialogTitle>
          <DialogDescription>
            Review the changes before approving or rejecting this sync job
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" data-testid="preview-content">
          {/* Job Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Content Type</p>
              <p className="text-sm" data-testid="preview-content-type">{job.contentType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">RaC Table</p>
              <p className="text-sm" data-testid="preview-rac-table">{job.racTableName}</p>
            </div>
            {job.racFieldName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Field Changed</p>
                <p className="text-sm" data-testid="preview-field-name">{job.racFieldName}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge 
                variant={job.status === 'pending' ? 'secondary' : job.status === 'approved' ? 'default' : 'destructive'}
                data-testid="preview-status"
              >
                {job.status}
              </Badge>
            </div>
          </div>

          {/* Before/After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto" data-testid="preview-old-value">
                  {formatValue(job.oldValue)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  New Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded overflow-x-auto border border-green-200 dark:border-green-800" data-testid="preview-new-value">
                  {formatValue(job.newValue)}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Regenerated Content Preview */}
          {job.regeneratedContent && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Regenerated Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: job.regeneratedContent }}
                  data-testid="preview-regenerated-content"
                />
              </CardContent>
            </Card>
          )}

          {/* Review Notes */}
          {job.reviewNotes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Review Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" data-testid="preview-review-notes">{job.reviewNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {job.error && (
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-destructive">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive" data-testid="preview-error">{job.error}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-preview">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

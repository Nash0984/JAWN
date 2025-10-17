import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, FileCheck, AlertCircle, FileText, Search, Download, FileDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface ClientVerificationDocument {
  id: string;
  documentId: string;
  clientCaseId?: string;
  sessionId?: string;
  requirementType: string;
  verificationStatus: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
  isValid: boolean;
  confidenceScore?: number;
  satisfiesRequirements?: string[];
  rejectionReasons?: string[];
  warnings?: string[];
  validUntil?: string;
  extractedData?: any;
  rawVisionResponse?: any;
  validationWarnings?: string[];
  validationErrors?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Review form schema
const reviewFormSchema = z.object({
  reviewNotes: z.string()
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export default function DocumentReviewQueue() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("pending_review");
  const [filterCaseId, setFilterCaseId] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<ClientVerificationDocument | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | 'needs_more_info'>('approved');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form with validation
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      reviewNotes: ""
    }
  });

  // Build filter URL
  const buildFilterUrl = () => {
    const params = new URLSearchParams();
    if (filterStatus) params.append("verificationStatus", filterStatus);
    if (filterCaseId) params.append("clientCaseId", filterCaseId);
    const queryString = params.toString();
    return queryString ? `/api/document-review/queue?${queryString}` : "/api/document-review/queue";
  };

  // Fetch documents with filters
  const { data: documents = [], isLoading } = useQuery<ClientVerificationDocument[]>({
    queryKey: ["/api/document-review/queue", filterStatus, filterCaseId],
    queryFn: async () => {
      const response = await fetch(buildFilterUrl(), { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    }
  });

  // Update document status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await fetch(`/api/document-review/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          verificationStatus: status,
          reviewNotes: notes
        })
      });
      if (!response.ok) throw new Error("Failed to update document status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-review/queue"] });
      toast({
        title: "Document Reviewed",
        description: "Document status has been updated successfully."
      });
      setReviewDialogOpen(false);
      setSelectedDoc(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const response = await fetch('/api/document-review/bulk-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentIds: ids,
          verificationStatus: status
        })
      });
      if (!response.ok) throw new Error("Failed to bulk update documents");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-review/queue"] });
      toast({
        title: "Bulk Update Complete",
        description: `Successfully updated ${data.updated} document(s).`
      });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingDocuments.length && pendingDocuments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingDocuments.map(doc => doc.id)));
    }
  };

  const handleBulkAction = (status: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      status
    });
  };

  // Filter pending documents for bulk actions
  const pendingDocuments = documents.filter(doc => doc.verificationStatus === 'pending_review');

  const handleReviewSubmit = (data: ReviewFormValues) => {
    if (!selectedDoc) return;

    // Validate notes are required for reject/needs_more_info
    if ((reviewAction === 'rejected' || reviewAction === 'needs_more_info') && !data.reviewNotes.trim()) {
      form.setError('reviewNotes', {
        type: 'manual',
        message: 'Review notes are required for rejection or requesting more info'
      });
      return;
    }

    updateStatusMutation.mutate({
      id: selectedDoc.id,
      status: reviewAction,
      notes: data.reviewNotes
    });
  };

  const openReviewDialog = (doc: ClientVerificationDocument, action: 'approved' | 'rejected' | 'needs_more_info') => {
    setSelectedDoc(doc);
    setReviewAction(action);
    form.reset({ reviewNotes: "" });
    setReviewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: { icon: CheckCircle2, variant: "default" as const, text: "Approved" },
      pending_review: { icon: Clock, variant: "secondary" as const, text: "Pending Review" },
      rejected: { icon: XCircle, variant: "destructive" as const, text: "Rejected" },
      needs_more_info: { icon: AlertCircle, variant: "outline" as const, text: "Needs More Info" }
    };
    const config = variants[status as keyof typeof variants] || variants.pending_review;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  // Document thumbnail component
  const DocumentThumbnail = ({ doc }: { doc: ClientVerificationDocument }) => {
    const [imageError, setImageError] = useState(false);
    const isPDF = doc.documentUrl?.toLowerCase().endsWith('.pdf');
    const isImage = doc.documentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    return (
      <div className="w-20 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden border border-border flex items-center justify-center" data-testid={`thumbnail-${doc.id}`}>
        {doc.documentUrl && isImage && !imageError ? (
          <img
            src={doc.documentUrl}
            alt={`${doc.requirementType} preview`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : isPDF ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="h-8 w-8 mb-1" />
            <span className="text-xs font-medium">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="h-8 w-8 mb-1" />
            <span className="text-xs font-medium">DOC</span>
          </div>
        )}
      </div>
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    import('papaparse').then(Papa => {
      const csvData = documents.map(doc => ({
        'Document ID': doc.id,
        'Requirement Type': doc.requirementType.replace(/_/g, ' '),
        'Status': doc.verificationStatus,
        'Valid': doc.isValid ? 'Yes' : 'No',
        'Confidence': doc.confidenceScore ? `${Math.round(doc.confidenceScore * 100)}%` : 'N/A',
        'Case ID': doc.clientCaseId || 'N/A',
        'Submitted Date': format(new Date(doc.createdAt), 'MMM d, yyyy h:mm a'),
        'Reviewed Date': doc.reviewedAt ? format(new Date(doc.reviewedAt), 'MMM d, yyyy h:mm a') : 'N/A',
        'Review Notes': doc.reviewNotes || 'N/A'
      }));

      const csv = Papa.default.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `document-review-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Complete",
        description: `Exported ${documents.length} documents to CSV`
      });
    });
  };

  // Export to PDF
  const exportToPDF = () => {
    import('jspdf').then(jsPDF => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF.default();
        
        // Maryland DHS Header
        doc.setFillColor(13, 79, 139); // MD Blue
        doc.rect(0, 0, 210, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('Maryland Benefits Navigator', 105, 15, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text('Document Review History Report', 105, 23, { align: 'center' });
        
        // Reset colors
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 38);
        doc.text(`Status Filter: ${filterStatus ? filterStatus.replace(/_/g, ' ') : 'All Statuses'}`, 14, 44);
        doc.text(`Case ID Filter: ${filterCaseId || 'All Cases'}`, 14, 50);
        doc.text(`Total Documents: ${documents.length}`, 14, 56);
        
        // Table data
        const tableData = documents.map(d => [
          d.requirementType.replace(/_/g, ' '),
          d.verificationStatus.replace(/_/g, ' '),
          d.isValid ? 'Yes' : 'No',
          d.confidenceScore ? `${Math.round(d.confidenceScore * 100)}%` : 'N/A',
          format(new Date(d.createdAt), 'MM/dd/yy'),
          d.reviewedAt ? format(new Date(d.reviewedAt), 'MM/dd/yy') : 'N/A'
        ]);

        (doc as any).autoTable({
          startY: 64,
          head: [['Requirement', 'Status', 'Valid', 'Confidence', 'Submitted', 'Reviewed']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [13, 79, 139], // MD Blue
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 8,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 30 },
            2: { cellWidth: 15 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 25 }
          }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text(
            `Maryland Department of Human Services - Page ${i} of ${pageCount}`,
            105,
            285,
            { align: 'center' }
          );
        }

        doc.save(`document-review-history-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

        toast({
          title: "Export Complete",
          description: `Exported ${documents.length} documents to PDF`
        });
      });
    });
  };

  return (
    <>
      <Helmet>
        <title>Document Review - MD Benefits Navigator</title>
      </Helmet>
      <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Review Queue</h1>
          <p className="text-muted-foreground mt-2">
            Review and approve client verification documents for benefit applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={documents.length === 0}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            disabled={documents.length === 0}
            data-testid="button-export-pdf"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filter Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterStatus">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="needs_more_info">Needs More Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterCaseId">Client Case ID</Label>
              <Input
                id="filterCaseId"
                data-testid="input-filter-case-id"
                value={filterCaseId}
                onChange={(e) => setFilterCaseId(e.target.value)}
                placeholder="Filter by case ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {pendingDocuments.length > 0 && (
        <Card className="bg-md-blue/5 dark:bg-md-blue/10 border-md-blue/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="select-all"
                  checked={selectedIds.size === pendingDocuments.length && pendingDocuments.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                  aria-label="Select all documents"
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  {selectedIds.size > 0 
                    ? `${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''} selected`
                    : 'Select all pending documents'}
                </Label>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleBulkAction('approved')}
                    disabled={bulkUpdateMutation.isPending}
                    data-testid="button-bulk-approve"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve Selected ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction('rejected')}
                    disabled={bulkUpdateMutation.isPending}
                    data-testid="button-bulk-reject"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject Selected ({selectedIds.size})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No documents found matching your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <DocumentThumbnail doc={doc} />
                  {doc.verificationStatus === 'pending_review' && (
                    <Checkbox
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={() => toggleSelection(doc.id)}
                      data-testid={`checkbox-document-${doc.id}`}
                      aria-label={`Select document ${doc.requirementType}`}
                      className="mt-1"
                    />
                  )}
                  <div className="flex items-start justify-between flex-1">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {doc.requirementType.replace(/_/g, ' ').toUpperCase()}
                        {getStatusBadge(doc.verificationStatus)}
                      </CardTitle>
                      <CardDescription>
                        {doc.clientCaseId && `Case ID: ${doc.clientCaseId}`}
                        {doc.sessionId && ` • Session: ${doc.sessionId.slice(0, 8)}...`}
                      </CardDescription>
                    </div>
                    {doc.verificationStatus === 'pending_review' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openReviewDialog(doc, 'approved')}
                        data-testid={`button-approve-${doc.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openReviewDialog(doc, 'rejected')}
                        data-testid={`button-reject-${doc.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReviewDialog(doc, 'needs_more_info')}
                        data-testid={`button-more-info-${doc.id}`}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        More Info
                      </Button>
                    </div>
                  )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valid:</span>
                      <p className="font-medium mt-1">{doc.isValid ? 'Yes' : 'No'}</p>
                    </div>
                    {doc.confidenceScore !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <p className="font-medium mt-1">{Math.round(doc.confidenceScore * 100)}%</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <p className="font-medium mt-1">
                        {format(new Date(doc.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {doc.reviewedAt && (
                      <div>
                        <span className="text-muted-foreground">Reviewed:</span>
                        <p className="font-medium mt-1">
                          {format(new Date(doc.reviewedAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {doc.satisfiesRequirements && doc.satisfiesRequirements.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Satisfies Requirements:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.satisfiesRequirements.map((req, idx) => (
                          <Badge key={idx} variant="secondary">{req}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {doc.warnings && doc.warnings.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Warnings:</span>
                      <ul className="mt-1 text-sm list-disc list-inside text-yellow-600 dark:text-yellow-500">
                        {doc.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {doc.rejectionReasons && doc.rejectionReasons.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Rejection Reasons:</span>
                      <ul className="mt-1 text-sm list-disc list-inside text-red-600 dark:text-red-500">
                        {doc.rejectionReasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {doc.reviewNotes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Review Notes:</span>
                      <p className="mt-1 text-sm bg-muted p-3 rounded-md">
                        {doc.reviewNotes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' && 'Approve Document'}
              {reviewAction === 'rejected' && 'Reject Document'}
              {reviewAction === 'needs_more_info' && 'Request More Information'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approved' && 'Confirm that this document meets all requirements and can be approved.'}
              {reviewAction === 'rejected' && 'Provide reasons for rejecting this document.'}
              {reviewAction === 'needs_more_info' && 'Explain what additional information is needed.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReviewSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reviewNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Notes {reviewAction !== 'approved' && '(Required)'}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="textarea-review-notes"
                        placeholder={
                          reviewAction === 'approved' 
                            ? 'Optional notes about this approval...' 
                            : 'Explain the issue or what is needed...'
                        }
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReviewDialogOpen(false);
                    form.reset();
                  }}
                  data-testid="button-cancel-review"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  variant={reviewAction === 'rejected' ? 'destructive' : 'default'}
                  data-testid="button-submit-review"
                >
                  {updateStatusMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

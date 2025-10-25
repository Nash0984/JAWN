import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { TaxpayerStatusBadge } from "@/components/taxpayer/TaxpayerStatusBadge";
import { DeadlineIndicator } from "@/components/taxpayer/DeadlineIndicator";
import { FileText, Upload, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";

export default function TaxpayerDocumentRequests() {
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [uploadingRequestId, setUploadingRequestId] = useState<string | null>(null);
  const [taxpayerNotes, setTaxpayerNotes] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/taxpayer/document-requests"],
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, documentId, notes }: any) => {
      const response = await apiRequest("PATCH", `/api/taxpayer/document-requests/${requestId}`, {
        status,
        uploadedDocumentId: documentId,
        taxpayerNotes: notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxpayer/document-requests"] });
      toast({
        title: "Document Uploaded",
        description: "Your document has been submitted successfully.",
      });
      setUploadingRequestId(null);
      setTaxpayerNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/documents/upload-url", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: any, requestId: string) => {
    try {
      if (result.successful.length > 0) {
        const uploadedFile = result.successful[0];

        // Create document record
        const docResponse = await apiRequest("POST", "/api/documents", {
          filename: uploadedFile.name,
          originalName: uploadedFile.name,
          objectPath: uploadedFile.uploadURL,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.type,
          status: "uploaded",
        });

        const docData = await docResponse.json();

        // Update the request with the uploaded document
        await updateRequestMutation.mutateAsync({
          requestId,
          status: "fulfilled",
          documentId: docData.id,
          notes: taxpayerNotes,
        });
      }
    } catch (error) {
      // console.error("Upload completion error:", error);
      toast({
        title: "Upload Error",
        description: "Failed to process uploaded file.",
        variant: "destructive",
      });
    }
  };

  const pendingRequests = requests?.filter(req => req.status === "pending") || [];
  const fulfilledRequests = requests?.filter(req => req.status === "fulfilled") || [];

  return (
    <>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2" data-testid="page-title">
            Document Requests
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Upload documents requested by your tax navigator
          </p>
        </div>

        {/* Pending Requests */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground dark:text-foreground mb-4">
            Pending Requests ({pendingRequests.length})
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="empty-state-pending">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 dark:text-green-400 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-foreground dark:text-foreground mb-2">All Caught Up!</h3>
                <p className="text-muted-foreground dark:text-muted-foreground text-center">
                  You don't have any pending document requests at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request: any) => (
                <Card
                  key={request.id}
                  className="bg-card dark:bg-card border-border dark:border-border hover:shadow-md transition-shadow"
                  data-testid={`request-card-${request.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-primary dark:text-primary" aria-hidden="true" />
                          <CardTitle className="text-foreground dark:text-foreground" data-testid={`text-request-name-${request.id}`}>
                            {request.documentName}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                          {request.description}
                        </CardDescription>
                      </div>
                      <TaxpayerStatusBadge status={request.status} data-testid={`text-request-status-${request.id}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.dueDate && (
                      <DeadlineIndicator dueDate={request.dueDate} />
                    )}

                    <div className="pt-4 border-t border-border dark:border-border">
                      <Button
                        onClick={() => setUploadingRequestId(request.id)}
                        className="w-full"
                        data-testid={`button-upload-document-${request.id}`}
                      >
                        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                        Upload Document
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Fulfilled Requests */}
        {fulfilledRequests.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-foreground dark:text-foreground mb-4">
              Submitted Documents ({fulfilledRequests.length})
            </h2>
            <div className="space-y-4">
              {fulfilledRequests.map((request: any) => (
                <Card
                  key={request.id}
                  className="bg-muted/30 dark:bg-muted/10 border-border dark:border-border"
                  data-testid={`fulfilled-card-${request.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" aria-hidden="true" />
                          <CardTitle className="text-foreground dark:text-foreground">
                            {request.documentName}
                          </CardTitle>
                        </div>
                        {request.taxpayerNotes && (
                          <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                            Note: {request.taxpayerNotes}
                          </CardDescription>
                        )}
                      </div>
                      <TaxpayerStatusBadge status={request.status} />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={!!uploadingRequestId} onOpenChange={(open) => !open && setUploadingRequestId(null)}>
        <DialogContent className="bg-card dark:bg-card border-border dark:border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-foreground">Upload Document</DialogTitle>
            <DialogDescription className="text-muted-foreground dark:text-muted-foreground">
              {uploadingRequestId && requests?.find(r => r.id === uploadingRequestId)?.documentName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="taxpayer-notes" className="text-foreground dark:text-foreground">
                Notes (Optional)
              </Label>
              <Textarea
                id="taxpayer-notes"
                placeholder="Add any notes about this document..."
                value={taxpayerNotes}
                onChange={(e) => setTaxpayerNotes(e.target.value)}
                className="mt-2 bg-background dark:bg-background text-foreground dark:text-foreground border-border dark:border-border"
                rows={3}
                data-testid="textarea-taxpayer-notes"
              />
            </div>

            <div className="border-2 border-dashed border-border dark:border-border rounded-lg p-8 text-center bg-muted/20 dark:bg-muted/10">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground dark:text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-4">
                Select a file to upload (PDF, JPG, PNG - max 10MB)
              </p>
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={(result) => uploadingRequestId && handleUploadComplete(result, uploadingRequestId)}
                buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                Select File
              </ObjectUploader>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

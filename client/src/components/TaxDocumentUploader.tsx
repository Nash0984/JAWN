import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ObjectUploader } from "@/components/ObjectUploader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, FileText, Trash2, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface TaxDocumentUploaderProps {
  vitaSessionId: string;
  onUploadComplete?: (extractedData: any, documentType: string) => void;
  onError?: (error: string) => void;
}

interface UploadedTaxDocument {
  id: string;
  documentType: string;
  extractedData: any;
  geminiConfidence: number;
  requiresManualReview: boolean;
  verificationStatus: string;
  createdAt: string;
}

const TAX_DOCUMENT_TYPES = [
  { value: "w2", label: "W-2 (Wage and Tax Statement)" },
  { value: "1099-misc", label: "1099-MISC (Miscellaneous Income)" },
  { value: "1099-nec", label: "1099-NEC (Nonemployee Compensation)" },
  { value: "1099-int", label: "1099-INT (Interest Income)" },
  { value: "1099-div", label: "1099-DIV (Dividends)" },
  { value: "ssa-1099", label: "SSA-1099 (Social Security Benefits)" },
  { value: "1099-r", label: "1099-R (Retirement Distributions)" },
  { value: "1095-a", label: "1095-A (Health Insurance Marketplace)" },
  { value: "1098", label: "1098 (Mortgage Interest)" },
  { value: "1098-e", label: "1098-E (Student Loan Interest)" },
  { value: "1098-t", label: "1098-T (Tuition Statement)" },
  { value: "other", label: "Other Tax Document" },
];

export function TaxDocumentUploader({ vitaSessionId, onUploadComplete, onError }: TaxDocumentUploaderProps) {
  const { toast } = useToast();
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Fetch existing tax documents for this session
  const { data: taxDocuments = [], isLoading: isLoadingDocs } = useQuery<UploadedTaxDocument[]>({
    queryKey: ["/api/vita-intake", vitaSessionId, "tax-documents"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadData: {
      filename: string;
      originalName: string;
      objectPath: string;
      fileSize: number;
      mimeType: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/vita-intake/${vitaSessionId}/tax-documents`,
        uploadData
      );
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake", vitaSessionId, "tax-documents"] });
      setIsProcessing(false);
      setProcessingProgress(100);
      
      toast({
        title: "Document Processed Successfully",
        description: `${data.taxDocument.documentType.toUpperCase()} extracted with ${Math.round(data.taxDocument.geminiConfidence * 100)}% confidence`,
      });

      if (onUploadComplete) {
        onUploadComplete(data.extractedData, data.taxDocument.documentType);
      }

      setTimeout(() => {
        setProcessingProgress(0);
      }, 2000);
    },
    onError: (error: any) => {
      setIsProcessing(false);
      setProcessingProgress(0);
      const errorMessage = error.message || "Failed to process tax document";
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
      if (onError) {
        onError(errorMessage);
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest(
        "DELETE",
        `/api/vita-intake/${vitaSessionId}/tax-documents/${documentId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-intake", vitaSessionId, "tax-documents"] });
      toast({
        title: "Document Deleted",
        description: "Tax document has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Get presigned URL for upload
  const handleGetUploadParameters = async () => {
    setIsProcessing(true);
    setProcessingProgress(10);
    const response = await apiRequest(
      "POST",
      `/api/vita-intake/${vitaSessionId}/tax-documents/upload-url`,
      {}
    );
    const data = await response.json();
    setProcessingProgress(30);
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  // Handle upload completion
  const handleUploadComplete = async (result: any) => {
    try {
      if (result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        setProcessingProgress(60);
        
        await uploadMutation.mutateAsync({
          filename: uploadedFile.name,
          originalName: uploadedFile.name,
          objectPath: uploadedFile.uploadURL,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.type,
        });
      }
    } catch (error) {
      console.error("Upload completion error:", error);
    }
  };

  // Format extracted data for display
  const formatExtractedData = (doc: UploadedTaxDocument) => {
    const data = doc.extractedData;
    const type = doc.documentType;

    if (type === "w2") {
      return {
        "Employer": data.employerName || "N/A",
        "Employee": data.employeeName || "N/A",
        "Wages (Box 1)": data.box1_wages ? `$${(data.box1_wages / 100).toFixed(2)}` : "$0.00",
        "Federal Tax Withheld (Box 2)": data.box2_federalTaxWithheld ? `$${(data.box2_federalTaxWithheld / 100).toFixed(2)}` : "$0.00",
        "Social Security Wages (Box 3)": data.box3_socialSecurityWages ? `$${(data.box3_socialSecurityWages / 100).toFixed(2)}` : "$0.00",
      };
    } else if (type === "1099-misc" || type === "1099-nec") {
      return {
        "Payer": data.payerName || "N/A",
        "Recipient": data.recipientName || "N/A",
        "Amount": data.box1_nonemployeeCompensation 
          ? `$${(data.box1_nonemployeeCompensation / 100).toFixed(2)}` 
          : (data.box3_otherIncome ? `$${(data.box3_otherIncome / 100).toFixed(2)}` : "$0.00"),
        "Federal Tax Withheld": data.box4_federalTaxWithheld ? `$${(data.box4_federalTaxWithheld / 100).toFixed(2)}` : "$0.00",
      };
    } else if (type === "1095-a") {
      return {
        "Marketplace": data.marketplaceName || "N/A",
        "Policy Number": data.policyNumber || "N/A",
        "Total SLCSP Premium": data.annualTotals?.slcspTotal ? `$${(data.annualTotals.slcspTotal / 100).toFixed(2)}` : "$0.00",
        "Total APTC": data.annualTotals?.aptcTotal ? `$${(data.annualTotals.aptcTotal / 100).toFixed(2)}` : "$0.00",
      };
    }

    return { "Document Type": type.toUpperCase(), "Status": "Extracted" };
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Tax Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Type Selector */}
          <div>
            <Label htmlFor="tax-doc-type">Document Type (Optional)</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger id="tax-doc-type" data-testid="select-tax-document-type">
                <SelectValue placeholder="Auto-detect document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Auto-detect document type</SelectItem>
                {TAX_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload Buttons */}
          <div className="flex gap-3">
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={10485760} // 10MB
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              <span data-testid="button-upload-tax-document">Upload Document</span>
            </ObjectUploader>

            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={10485760}
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              <Camera className="mr-2 h-4 w-4" />
              <span data-testid="button-take-tax-photo">Take Photo</span>
            </ObjectUploader>
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-2" data-testid="panel-extraction-progress">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Processing document...</span>
              </div>
              <Progress value={processingProgress} className="w-full" />
            </div>
          )}

          {/* Upload Tips */}
          <Alert>
            <Camera className="h-4 w-4" />
            <AlertDescription>
              <strong>Photo Tips:</strong> Ensure good lighting, keep camera steady, capture entire document, and use high contrast backgrounds.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Uploaded Documents List */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Uploaded Tax Documents</h3>
        
        {isLoadingDocs ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : taxDocuments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No tax documents uploaded yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="list-tax-documents">
            {taxDocuments.map((doc) => {
              const formattedData = formatExtractedData(doc);
              
              return (
                <Card key={doc.id} data-testid={`card-extracted-data-${doc.documentType}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {doc.documentType.toUpperCase()}
                          {doc.verificationStatus === "verified" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground" data-testid="text-confidence-score">
                            Confidence: {Math.round(doc.geminiConfidence * 100)}%
                          </span>
                          {doc.requiresManualReview && (
                            <Badge variant="destructive" data-testid="badge-manual-review">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Manual Review Required
                            </Badge>
                          )}
                          {doc.verificationStatus === "verified" && (
                            <Badge variant="default" className="bg-green-600">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-tax-document-${doc.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(formattedData).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

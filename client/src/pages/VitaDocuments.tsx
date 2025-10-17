import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MessageSquare,
  FileSignature,
  Download,
  Mail,
  MapPin,
  Send,
  Paperclip,
  Eye,
  Loader2,
  ChevronRight,
  RefreshCcw,
  History,
  Shield,
  TrendingUp
} from "lucide-react";

interface DocumentCategory {
  id: string;
  label: string;
  description: string;
  icon: any;
  required: boolean;
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { id: "W2", label: "W-2 Wage and Tax Statement", description: "Annual wage and tax statement from employer", icon: FileText, required: true },
  { id: "1099_MISC", label: "1099-MISC", description: "Miscellaneous income", icon: FileText, required: false },
  { id: "1099_NEC", label: "1099-NEC", description: "Nonemployee compensation", icon: FileText, required: false },
  { id: "1099_INT", label: "1099-INT", description: "Interest income", icon: FileText, required: false },
  { id: "1099_DIV", label: "1099-DIV", description: "Dividends and distributions", icon: FileText, required: false },
  { id: "1099_R", label: "1099-R", description: "Distributions from pensions, annuities, retirement", icon: FileText, required: false },
  { id: "1095_A", label: "1095-A", description: "Health Insurance Marketplace Statement", icon: FileText, required: false },
  { id: "ID_DOCUMENT", label: "Photo ID", description: "Driver's license or state ID", icon: FileText, required: true },
  { id: "SUPPORTING_RECEIPT", label: "Supporting Receipts", description: "Deduction receipts and other documents", icon: FileText, required: false },
  { id: "OTHER", label: "Other Documents", description: "Any other tax-related documents", icon: FileText, required: false },
];

export default function VitaDocuments() {
  const { sessionId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState<string | null>(null);
  
  // Check if user is staff (can trigger extraction and create signature requests)
  const isStaff = user?.role === 'staff' || user?.role === 'navigator' || user?.role === 'caseworker' || user?.role === 'admin';

  // Fetch document requests
  const { data: documentRequests = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["/api/vita-documents", sessionId],
    enabled: !!sessionId,
  });

  // Fetch checklist progress
  const { data: checklist, isLoading: loadingChecklist } = useQuery({
    queryKey: ["/api/vita-documents", sessionId, "checklist"],
    enabled: !!sessionId,
  });

  // Fetch messages
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["/api/vita-messages", sessionId],
    enabled: !!sessionId,
  });

  // Fetch signature requests
  const { data: signatureRequests = [], isLoading: loadingSignatures } = useQuery({
    queryKey: ["/api/vita-signatures", sessionId],
    enabled: !!sessionId,
  });

  // Create document request mutation
  const createDocRequestMutation = useMutation({
    mutationFn: async (category: string) => {
      const categoryData = DOCUMENT_CATEGORIES.find(c => c.id === category);
      const res = await apiRequest("POST", "/api/vita-documents/request", {
        vitaSessionId: sessionId,
        category,
        categoryLabel: categoryData?.label || category,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId, "checklist"] });
      toast({ title: "Document request created", description: "You can now upload the document" });
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ requestId, file }: { requestId: string; file: File }) => {
      setUploadingFile(true);
      
      // Upload file to object storage
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadResponse.ok) throw new Error("Upload failed");
      
      const uploadData = await uploadResponse.json();
      
      // Link document to request
      const linkRes = await apiRequest("POST", `/api/vita-documents/${requestId}/upload`, {
        filename: uploadData.filename,
        originalName: file.name,
        objectPath: uploadData.path,
        fileSize: file.size,
        mimeType: file.type,
      });
      const linkData = await linkRes.json();
      
      // Trigger extraction (staff-only feature)
      if (isStaff) {
        try {
          await apiRequest("POST", `/api/vita-documents/${requestId}/extract`, {});
        } catch (error) {
          console.warn("Extraction failed (staff-only feature):", error);
        }
      }
      
      return linkData;
    },
    onSuccess: () => {
      setUploadingFile(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId, "checklist"] });
      const message = isStaff 
        ? "Gemini Vision is extracting data..." 
        : "Your navigator will review and process this document";
      toast({ title: "Document uploaded successfully", description: message });
    },
    onError: () => {
      setUploadingFile(false);
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    },
  });

  // Batch upload mutation
  const batchUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setUploadingBatch(true);
      const formData = new FormData();
      files.forEach(file => formData.append("files", file));
      formData.append("vitaSessionId", sessionId!);
      formData.append("batchId", `batch_${Date.now()}`);

      const response = await fetch("/api/vita-documents/batch-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Batch upload failed");
      return await response.json();
    },
    onSuccess: (data) => {
      setUploadingBatch(false);
      setBatchFiles([]);
      setShowBatchUploadDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId, "checklist"] });
      
      const acceptedCount = data.results.filter((r: any) => r.qualityResult.isAcceptable).length;
      const rejectedCount = data.results.length - acceptedCount;
      
      toast({
        title: "Batch upload complete",
        description: `${acceptedCount} documents uploaded successfully. ${rejectedCount > 0 ? `${rejectedCount} failed quality checks.` : ""}`,
      });
    },
    onError: () => {
      setUploadingBatch(false);
      toast({ title: "Batch upload failed", description: "Please try again", variant: "destructive" });
    },
  });

  // Replace document mutation
  const replaceDocumentMutation = useMutation({
    mutationFn: async ({ requestId, file, reason }: { requestId: string; file: File; reason: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("reason", reason);

      const response = await fetch(`/api/vita-documents/${requestId}/replace`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Document replacement failed");
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/vita-documents", sessionId, "checklist"] });
      
      toast({
        title: "Document replaced",
        description: data.qualityResult.isAcceptable
          ? "New document uploaded successfully"
          : "Warning: New document failed quality checks",
        variant: data.qualityResult.isAcceptable ? "default" : "destructive",
      });
    },
  });

  // Secure download mutation
  const secureDownloadMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("POST", `/api/vita-documents/${requestId}/secure-download`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      window.open(data.signedUrl, "_blank");
      const expiryTime = new Date(data.expiresAt).toLocaleTimeString();
      toast({
        title: "Secure download link generated",
        description: `Link expires at ${expiryTime}`,
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/vita-messages", {
        vitaSessionId: sessionId,
        messageText: text,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-messages", sessionId] });
      setMessageText("");
      toast({ title: "Message sent", description: "Your message has been sent to the navigator" });
    },
  });

  // Request signature mutation
  const requestSignatureMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vita-signatures/request", {
        vitaSessionId: sessionId,
        formType: "form_8879",
        formTitle: "IRS e-file Authorization (Form 8879)",
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vita-signatures", sessionId] });
      setShowSignatureDialog(false);
      toast({ title: "Signature requested", description: "You will receive a notification to sign Form 8879" });
    },
  });

  const handleFileUpload = async (requestId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadDocumentMutation.mutate({ requestId, file });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: "Pending", variant: "outline", icon: Clock },
      uploaded: { label: "Uploaded", variant: "secondary", icon: Upload },
      extracted: { label: "Extracted", variant: "default", icon: CheckCircle2 },
      verified: { label: "Verified", variant: "default", icon: CheckCircle2 },
      rejected: { label: "Rejected", variant: "destructive", icon: AlertCircle },
    };

    const config = statusMap[status] || statusMap.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const progressPercentage = checklist ? ((checklist as any).verified / (checklist as any).totalRequested) * 100 : 0;
  const unreadMessages = (messages as any[]).filter((m: any) => !m.readAt).length;

  if (loadingDocs || loadingChecklist) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl" data-testid="vita-documents-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">VITA Document Upload Portal</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Upload your tax documents, communicate with your navigator, and sign forms electronically
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6" data-testid="card-progress-overview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Document Checklist Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium" data-testid="text-progress-label">
                  {(checklist as any)?.verified || 0} of {(checklist as any)?.totalRequested || 0} documents verified
                </span>
                <span className="text-sm text-muted-foreground" data-testid="text-progress-percentage">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress value={progressPercentage} data-testid="progress-bar-documents" />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg" data-testid="card-stat-uploaded">
                <div className="text-2xl font-bold">{(checklist as any)?.uploaded || 0}</div>
                <div className="text-xs text-muted-foreground">Uploaded</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg" data-testid="card-stat-extracted">
                <div className="text-2xl font-bold">{(checklist as any)?.extracted || 0}</div>
                <div className="text-xs text-muted-foreground">Extracted</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg" data-testid="card-stat-verified">
                <div className="text-2xl font-bold">{(checklist as any)?.verified || 0}</div>
                <div className="text-xs text-muted-foreground">Verified</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg" data-testid="card-stat-pending">
                <div className="text-2xl font-bold">{(checklist as any)?.pending || 0}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="documents" className="space-y-6" data-testid="tabs-main">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" className="relative" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
            {unreadMessages > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="destructive" data-testid="badge-unread-count">
                {unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="signatures" data-testid="tab-signatures">
            <FileSignature className="h-4 w-4 mr-2" />
            Signatures
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Document Categories</h2>
            <Dialog open={showBatchUploadDialog} onOpenChange={setShowBatchUploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-batch-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Batch Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="dialog-batch-upload">
                <DialogHeader>
                  <DialogTitle>Batch Document Upload</DialogTitle>
                  <DialogDescription>
                    Upload multiple documents at once. All files will be automatically checked for quality.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setBatchFiles(Array.from(e.target.files || []))}
                    disabled={uploadingBatch}
                    data-testid="input-batch-files"
                  />
                  {batchFiles.length > 0 && (
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="font-semibold">Selected Files ({batchFiles.length}):</p>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {batchFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4" />
                            <span>{file.name}</span>
                            <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => batchUploadMutation.mutate(batchFiles)}
                      disabled={batchFiles.length === 0 || uploadingBatch}
                      data-testid="button-confirm-batch-upload"
                    >
                      {uploadingBatch ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload {batchFiles.length} Files
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBatchFiles([]);
                        setShowBatchUploadDialog(false);
                      }}
                      disabled={uploadingBatch}
                      data-testid="button-cancel-batch-upload"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4">
            {DOCUMENT_CATEGORIES.map((category) => {
              const request = (documentRequests as any[]).find((r: any) => r.category === category.id);
              const Icon = category.icon;

              return (
                <Card key={category.id} data-testid={`card-category-${category.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-category-title-${category.id}`}>
                            {category.label}
                            {category.required && (
                              <Badge variant="secondary" className="ml-2" data-testid={`badge-required-${category.id}`}>
                                Required
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription data-testid={`text-category-description-${category.id}`}>
                            {category.description}
                          </CardDescription>
                        </div>
                      </div>
                      {request && getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!request ? (
                      <Button
                        onClick={() => createDocRequestMutation.mutate(category.id)}
                        disabled={createDocRequestMutation.isPending}
                        data-testid={`button-request-${category.id}`}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Request This Document
                      </Button>
                    ) : request.status === "pending" ? (
                      <div>
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUpload(request.id, e)}
                          disabled={uploadingFile}
                          data-testid={`input-file-${category.id}`}
                        />
                        {uploadingFile && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading and extracting data...
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-upload-info-${category.id}`}>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Uploaded {request.uploadedAt && `on ${new Date(request.uploadedAt).toLocaleDateString()}`}
                          </div>
                          {request.qualityScore !== null && request.qualityScore !== undefined && (
                            <div className="flex items-center gap-2" data-testid={`quality-score-${category.id}`}>
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className={`text-sm font-semibold ${request.qualityScore >= 80 ? 'text-green-600' : request.qualityScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {request.qualityScore}% Quality
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {request.qualityIssues && request.qualityIssues.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <div className="flex items-start gap-2 text-sm">
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <div>
                                <p className="font-semibold text-yellow-800">Quality Issues:</p>
                                <ul className="list-disc list-inside text-yellow-700">
                                  {request.qualityIssues.map((issue: string, idx: number) => (
                                    <li key={idx}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {request.extractedData && (
                            <Button variant="outline" size="sm" data-testid={`button-view-data-${category.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Extracted Data
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => secureDownloadMutation.mutate(request.id)}
                            disabled={secureDownloadMutation.isPending}
                            data-testid={`button-download-${category.id}`}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Secure Download
                          </Button>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" data-testid={`button-replace-${category.id}`}>
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Replace
                              </Button>
                            </DialogTrigger>
                            <DialogContent data-testid={`dialog-replace-${category.id}`}>
                              <DialogHeader>
                                <DialogTitle>Replace Document</DialogTitle>
                                <DialogDescription>
                                  Upload a better quality version or corrected document
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      replaceDocumentMutation.mutate({
                                        requestId: request.id,
                                        file,
                                        reason: "updated_version",
                                      });
                                    }
                                  }}
                                  data-testid={`input-replace-${category.id}`}
                                />
                                <p className="text-sm text-muted-foreground">
                                  The previous version will be archived and this new version will replace it.
                                </p>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          {isStaff && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowAuditTrail(request.id)}
                                  data-testid={`button-audit-${category.id}`}
                                >
                                  <History className="h-4 w-4 mr-2" />
                                  Audit Trail
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl" data-testid={`dialog-audit-${category.id}`}>
                                <DialogHeader>
                                  <DialogTitle>Document Audit Trail</DialogTitle>
                                  <DialogDescription>
                                    Complete history of document access and modifications
                                  </DialogDescription>
                                </DialogHeader>
                                <DocumentAuditTrail requestId={request.id} />
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card data-testid="card-messages">
            <CardHeader>
              <CardTitle>Secure Messages</CardTitle>
              <CardDescription>Communicate securely with your tax navigator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[400px] border rounded-lg p-4" data-testid="scroll-messages">
                {(messages as any[]).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8" data-testid="text-no-messages">
                    No messages yet. Start a conversation with your navigator.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(messages as any[]).map((message: any) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderRole === "navigator" ? "justify-start" : "justify-end"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.senderRole === "navigator"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1" data-testid={`text-sender-${message.id}`}>
                            {message.senderName}
                          </div>
                          <div className="text-sm" data-testid={`text-message-${message.id}`}>{message.messageText}</div>
                          <div className="text-xs opacity-70 mt-1" data-testid={`text-timestamp-${message.id}`}>
                            {new Date(message.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                  data-testid="textarea-message"
                />
                <Button
                  onClick={() => sendMessageMutation.mutate(messageText)}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures" className="space-y-4">
          <Card data-testid="card-signatures">
            <CardHeader>
              <CardTitle>E-Signature Requests</CardTitle>
              <CardDescription>Sign tax forms electronically with IRS-compliant e-signatures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(signatureRequests as any[]).length === 0 ? (
                <div className="text-center py-8" data-testid="text-no-signatures">
                  <FileSignature className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No signature requests yet</p>
                  {isStaff && (
                    <Button onClick={() => setShowSignatureDialog(true)} data-testid="button-request-signature">
                      <FileSignature className="h-4 w-4 mr-2" />
                      Request Form 8879 Signature
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {(signatureRequests as any[]).map((request: any) => (
                    <Card key={request.id} data-testid={`card-signature-${request.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base" data-testid={`text-signature-title-${request.id}`}>
                            {request.formTitle}
                          </CardTitle>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {request.status === "pending" ? (
                          <Button variant="default" data-testid={`button-sign-${request.id}`}>
                            <FileSignature className="h-4 w-4 mr-2" />
                            Sign Now
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`text-signed-${request.id}`}>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Signed on {new Date(request.signedAt).toLocaleDateString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Digital Delivery */}
          <Card data-testid="card-delivery">
            <CardHeader>
              <CardTitle>Digital Delivery Options</CardTitle>
              <CardDescription>Choose how to receive your completed tax documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button variant="outline" className="h-24 flex flex-col gap-2" data-testid="button-email-delivery">
                  <Mail className="h-6 w-6" />
                  <div className="text-sm font-medium">Email PDF Bundle</div>
                  <div className="text-xs text-muted-foreground">Secure download link</div>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col gap-2" data-testid="button-pickup-delivery">
                  <MapPin className="h-6 w-6" />
                  <div className="text-sm font-medium">Physical Pickup</div>
                  <div className="text-xs text-muted-foreground">In-person at VITA site</div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Signature Request Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent data-testid="dialog-signature-request">
          <DialogHeader>
            <DialogTitle>Request Form 8879 Signature</DialogTitle>
            <DialogDescription>
              This will send a request to sign the IRS e-file authorization form (Form 8879). You'll receive a
              notification when it's ready to sign.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)} data-testid="button-cancel-signature">
              Cancel
            </Button>
            <Button
              onClick={() => requestSignatureMutation.mutate()}
              disabled={requestSignatureMutation.isPending}
              data-testid="button-confirm-signature"
            >
              Request Signature
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentAuditTrail({ requestId }: { requestId: string }) {
  const { data: auditData, isLoading } = useQuery({
    queryKey: ["/api/vita-documents", requestId, "audit"],
    enabled: !!requestId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const auditTrail = (auditData as any)?.auditTrail || [];
  const stats = (auditData as any)?.stats || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.totalActions || 0}</div>
          <div className="text-xs text-muted-foreground">Total Actions</div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.downloadCount || 0}</div>
          <div className="text-xs text-muted-foreground">Downloads</div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.uniqueUsers || 0}</div>
          <div className="text-xs text-muted-foreground">Unique Users</div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {auditTrail.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No audit trail records found
            </div>
          ) : (
            auditTrail.map((record: any) => (
              <div key={record.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{record.action}</Badge>
                      <span className="text-sm font-semibold">{record.userName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.userRole} • {new Date(record.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {record.signedUrlGenerated && (
                    <Shield className="h-4 w-4 text-primary" />
                  )}
                </div>
                
                {record.previousStatus && record.newStatus && (
                  <div className="text-sm">
                    Status changed: <span className="font-mono">{record.previousStatus}</span> → <span className="font-mono">{record.newStatus}</span>
                  </div>
                )}
                
                {record.changeReason && (
                  <div className="text-sm text-muted-foreground">
                    Reason: {record.changeReason}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>IP: {record.ipAddress || "N/A"}</span>
                  {record.signedUrlExpiry && (
                    <span>• Expires: {new Date(record.signedUrlExpiry).toLocaleTimeString()}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Camera, 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  X,
  GripVertical
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PolicyChatWidget } from "@/components/PolicyChatWidget";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cardVariants, slideUpVariants, containerVariants, itemVariants } from "@/lib/animations";

interface VerificationResult {
  documentType: string;
  meetsCriteria: boolean;
  summary: string;
  requirements: Array<{
    requirement: string;
    met: boolean;
    explanation: string;
  }>;
  officialCitations: Array<{
    section: string;
    regulation: string;
    text: string;
  }>;
  confidence: number;
}

export default function DocumentVerification() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const verificationMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await apiUpload('/api/verify-document', formData);
      return response.json();
    },
    onSuccess: (data: VerificationResult) => {
      setResult(data);
      toast({
        title: "Document Analysis Complete",
        description: data.meetsCriteria 
          ? "Your document meets the requirements!" 
          : "We found some issues with your document.",
      });
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: "We couldn't analyze your document. Please try again or contact support.",
        variant: "destructive",
      });
      console.error("Verification error:", error);
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please choose a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.match(/^image\/(jpeg|jpg|png|gif)|application\/pdf$/)) {
      toast({
        title: "Unsupported File Type",
        description: "Please upload a JPG, PNG, GIF, or PDF file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setResult(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleVerification = () => {
    if (!selectedFile) {
      toast({
        title: "No Document Selected",
        description: "Please select a document to verify first.",
        variant: "destructive",
      });
      return;
    }
    verificationMutation.mutate(selectedFile);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
        data-testid="input-file-hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="hidden"
        data-testid="input-camera-hidden"
      />

      {!selectedFile && (
        <>
          {/* Upload Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={handleCameraCapture}
              data-testid="card-camera-upload"
            >
              <CardHeader className="text-center pb-4">
                <Camera className="h-8 w-8 mx-auto text-primary mb-2" />
                <CardTitle className="text-lg">Take Photo</CardTitle>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <p className="text-sm text-muted-foreground mb-4">
                  Use your camera to capture documents
                </p>
                <Button className="w-full" data-testid="button-camera-action">
                  Open Camera
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={handleFileUpload}
              data-testid="card-file-upload"
            >
              <CardHeader className="text-center pb-4">
                <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
                <CardTitle className="text-lg">Upload PDF</CardTitle>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <p className="text-sm text-muted-foreground mb-4">
                  Upload PDF documents
                </p>
                <Button variant="outline" className="w-full" data-testid="button-pdf-upload">
                  Choose PDF
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={handleFileUpload}
              data-testid="card-image-upload"
            >
              <CardHeader className="text-center pb-4">
                <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                <CardTitle className="text-lg">Upload Image</CardTitle>
              </CardHeader>
              <CardContent className="text-center pt-0">
                <p className="text-sm text-muted-foreground mb-4">
                  Upload JPG, PNG, or GIF files
                </p>
                <Button variant="outline" className="w-full" data-testid="button-image-upload">
                  Choose Image
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* File Preview and Results - Resizable Split View */}
      <AnimatePresence mode="wait">
        {selectedFile && result ? (
          <motion.div
            key="results-panel"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={cardVariants}
          >
            <ResizablePanelGroup
              direction="horizontal"
              className="min-h-[600px] rounded-lg border"
            >
          {/* Left Panel - Document Preview */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full p-6 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Document Preview</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center space-x-3 mb-6 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-filename">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-filesize">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>

              {previewUrl && (
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-950">
                  <img 
                    src={previewUrl} 
                    alt="Document preview" 
                    className="w-full h-auto object-contain"
                    data-testid="img-preview"
                  />
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle>
            <GripVertical className="h-4 w-4" />
          </ResizableHandle>

          {/* Right Panel - Verification Results */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full p-6 overflow-auto">
              <div className="flex items-center space-x-3 mb-6">
                {result.meetsCriteria ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                )}
                <div>
                  <h3 className={`text-xl font-semibold ${result.meetsCriteria ? "text-green-700" : "text-amber-700"}`}>
                    {result.meetsCriteria ? "Document Approved" : "Issues Found"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {result.documentType} • {result.confidence}% confidence
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Summary */}
                <div>
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-sm leading-relaxed" data-testid="text-summary">
                    {result.summary}
                  </p>
                </div>

                <Separator />
                
                {/* Requirements Check */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={containerVariants}
                >
                  <h4 className="font-semibold mb-3">Requirements Check</h4>
                  <div className="space-y-3">
                    {result.requirements.map((req, index) => (
                      <motion.div 
                        key={index} 
                        className="flex items-start space-x-3" 
                        data-testid={`requirement-${index}`}
                        variants={itemVariants}
                      >
                        {req.met ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{req.requirement}</p>
                          <p className="text-xs text-muted-foreground mt-1">{req.explanation}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <Separator />

                {/* Official Citations */}
                <div>
                  <h4 className="font-semibold mb-3">Official Policy Citations</h4>
                  <div className="space-y-3">
                    {result.officialCitations.map((citation, index) => (
                      <div key={index} className="bg-muted/50 p-4 rounded-lg" data-testid={`citation-${index}`}>
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {citation.section}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {citation.regulation}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {citation.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={clearSelection} 
                    className="w-full"
                    data-testid="button-verify-another"
                  >
                    Verify Another Document
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
          </motion.div>
        ) : selectedFile && !result ? (
        /* File Preview - No Results Yet */
        <motion.div
          key="file-preview"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={slideUpVariants}
        >
          <Card data-testid="card-file-preview">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Document Ready</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="text-filename">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-filesize">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>

            {previewUrl && (
              <div className="mb-4">
                <img 
                  src={previewUrl} 
                  alt="Document preview" 
                  className="max-w-full h-32 object-contain rounded border"
                  data-testid="img-preview"
                />
              </div>
            )}

            <Button 
              onClick={handleVerification}
              disabled={verificationMutation.isPending}
              className="w-full"
              data-testid="button-verify-document"
            >
              {verificationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Document...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Check This Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Policy Chat Widget - Always available */}
      <PolicyChatWidget 
        context={{ 
          page: 'document-verification',
          documentType: selectedFile ? selectedFile.name.split('.')[0] : undefined
        }}
      />
    </div>
  );
}
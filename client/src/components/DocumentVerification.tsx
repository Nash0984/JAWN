import { useState, useRef } from "react";
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
  X
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
      
      const response = await fetch('/api/verify-document', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify document');
      }
      
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

      {/* File Preview */}
      {selectedFile && (
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
      )}

      {/* Verification Results */}
      {result && (
        <Card className="border-2 border-border" data-testid="card-verification-result">
          <CardHeader>
            <div className="flex items-center space-x-3">
              {result.meetsCriteria ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-amber-600" />
              )}
              <div>
                <CardTitle className={result.meetsCriteria ? "text-green-700" : "text-amber-700"}>
                  {result.meetsCriteria ? "Document Approved" : "Issues Found"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {result.documentType} • {result.confidence}% confidence
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-sm leading-relaxed" data-testid="text-summary">
                {result.summary}
              </p>
            </div>

            <Separator className="my-6" />

            {/* Requirements Check */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Requirements Check</h3>
              <div className="space-y-3">
                {result.requirements.map((req, index) => (
                  <div key={index} className="flex items-start space-x-3" data-testid={`requirement-${index}`}>
                    {req.met ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{req.requirement}</p>
                      <p className="text-xs text-muted-foreground mt-1">{req.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Official Citations */}
            <div>
              <h3 className="font-semibold mb-3">Official Policy Citations</h3>
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

            <div className="mt-6 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={clearSelection} 
                className="w-full"
                data-testid="button-verify-another"
              >
                Verify Another Document
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
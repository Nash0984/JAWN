import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudUpload, Camera, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function DocumentUpload() {
  const [documentTypeId, setDocumentTypeId] = useState<string>("");
  const [benefitProgramId, setBenefitProgramId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const { data: documentTypes = [] } = useQuery({
    queryKey: ["/api/public/document-types"],
  });

  const { data: benefitPrograms = [] } = useQuery({
    queryKey: ["/api/public/benefit-programs"],
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/documents/upload-url", {});
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    try {
      if (result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        
        // Create document record
        await apiRequest("POST", "/api/documents", {
          filename: uploadedFile.name,
          originalName: uploadedFile.name,
          objectPath: uploadedFile.uploadURL,
          documentTypeId: documentTypeId || null,
          benefitProgramId: benefitProgramId || null,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.type,
          status: "uploaded",
        });

        toast({
          title: "Upload Successful",
          description: `${uploadedFile.name} has been uploaded and is being processed.`,
        });

        // Reset form
        setDocumentTypeId("");
        setBenefitProgramId("");
        setSelectedFiles([]);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  return (
    <Card className="shadow-lg border border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-foreground">
          Upload Policy Documents
        </CardTitle>
        <p className="text-muted-foreground">
          Upload policy manuals, notices, or guidance documents. Our AI will automatically classify and extract key information.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Upload Zone */}
        <div className="upload-zone rounded-lg p-8 text-center border-2 border-dashed border-border hover:border-primary transition-colors">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <CloudUpload className="text-2xl text-muted-foreground h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">Drop files here or click to upload</p>
              <p className="text-sm text-muted-foreground">PDF, DOC, DOCX up to 10MB each</p>
            </div>
            <div className="flex justify-center space-x-4">
              <label htmlFor="file-upload">
                <Button className="cursor-pointer" data-testid="button-browse-files">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              
              <ObjectUploader
                maxNumberOfFiles={5}
                maxFileSize={10485760} // 10MB
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </ObjectUploader>
            </div>
          </div>
        </div>

        {/* Document Type Selection */}
        <div>
          <Label className="block text-sm font-medium text-foreground mb-2">
            Document Type (Optional)
          </Label>
          <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
            <SelectTrigger data-testid="select-document-type">
              <SelectValue placeholder="Auto-detect document type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect document type</SelectItem>
              {documentTypes.map((type: any) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Program Assignment */}
        <div>
          <Label className="block text-sm font-medium text-foreground mb-2">
            Benefit Program
          </Label>
          <Select value={benefitProgramId} onValueChange={setBenefitProgramId}>
            <SelectTrigger data-testid="select-benefit-program">
              <SelectValue placeholder="Auto-detect program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect program</SelectItem>
              {benefitPrograms.map((program: any) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Camera Quality Tips */}
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium text-foreground mb-2 flex items-center">
            <Camera className="mr-2 h-4 w-4" />
            Document Photo Tips
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Ensure good lighting and avoid shadows</li>
            <li>• Keep camera steady to prevent blur</li>
            <li>• Capture entire document in frame</li>
            <li>• Use high contrast backgrounds</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

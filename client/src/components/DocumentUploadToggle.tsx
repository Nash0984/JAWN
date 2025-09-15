import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import DocumentVerificationInterface from "./DocumentVerificationInterface";

export default function DocumentUploadToggle() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="space-y-4">
      <Button 
        onClick={() => setShowUpload(!showUpload)}
        variant="outline"
        className="mx-auto flex items-center space-x-2"
        data-testid="button-toggle-upload"
      >
        <FileText className="h-4 w-4" />
        <span>{showUpload ? "Hide" : "Check"} Document Upload</span>
        {showUpload ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      
      {showUpload && (
        <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
          <DocumentVerificationInterface />
        </div>
      )}
    </div>
  );
}
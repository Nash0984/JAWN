import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, CheckCircle, RefreshCw, Image } from "lucide-react";

export default function ProcessingStatus() {
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["/api/documents"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />;
      case "processed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "text-blue-600";
      case "processed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="h-4 w-4 text-gray-500" />;
    }
    return <FileText className="h-4 w-4 text-blue-500" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">
            Processing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const processingDocs = documents.filter((doc: any) => doc.status === "processing");
  const recentDocs = documents.slice(0, 5);

  return (
    <Card className="shadow-lg border border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-foreground">
          Processing Status
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {recentDocs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No documents uploaded yet</p>
          </div>
        ) : (
          recentDocs.map((doc: any) => (
            <div 
              key={doc.id} 
              className={`border rounded-lg p-4 ${
                doc.status === "processing" ? "processing-animation border-blue-200 bg-blue-50" :
                doc.status === "processed" ? "border-green-200 bg-green-50" :
                doc.status === "failed" ? "border-red-200 bg-red-50" :
                "border-border"
              }`}
              data-testid={`document-status-${doc.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getFileIcon(doc.mimeType)}
                  <span className="font-medium text-foreground truncate max-w-xs">
                    {doc.originalName || doc.filename}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(doc.status)}
                  <span className={`text-sm capitalize ${getStatusColor(doc.status)}`}>
                    {doc.status === "processing" ? "Processing..." : doc.status}
                  </span>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                {doc.documentType?.name && `Type: ${doc.documentType.name} | `}
                {doc.benefitProgram?.name && `Program: ${doc.benefitProgram.name} | `}
                Size: {formatFileSize(doc.fileSize)}
                {doc.qualityScore && ` | Quality: ${(doc.qualityScore * 100).toFixed(0)}%`}
              </div>

              {/* Processing Progress */}
              {doc.status === "processing" && doc.processingStatus && (
                <div className="space-y-2">
                  <Progress 
                    value={(doc.processingStatus.progress || 0) * 100} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-4">
                      {doc.processingStatus.completedSteps?.includes("quality_check") && (
                        <div className="text-green-600">✓ Quality Assessment</div>
                      )}
                      {doc.processingStatus.completedSteps?.includes("ocr") && (
                        <div className="text-green-600">✓ OCR Extraction</div>
                      )}
                      {doc.processingStatus.completedSteps?.includes("classification") && (
                        <div className="text-green-600">✓ Document Classification</div>
                      )}
                      {doc.processingStatus.completedSteps?.includes("chunking") && (
                        <div className="text-green-600">✓ Text Chunking</div>
                      )}
                      {doc.processingStatus.stage === "embedding" && (
                        <div className="text-blue-600">⟳ Vector Embedding Generation</div>
                      )}
                      {doc.processingStatus.stage === "indexing" && (
                        <div className="text-blue-600">⟳ Index Storage</div>
                      )}
                    </div>
                    {doc.processingStatus.message && (
                      <div className="mt-1 text-blue-600">
                        {doc.processingStatus.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Success Status */}
              {doc.status === "processed" && (
                <div className="text-xs text-green-600">
                  ✓ {doc.metadata?.chunksCount || 0} text chunks extracted
                  {doc.ocrAccuracy && ` • ✓ ${(doc.ocrAccuracy * 100).toFixed(0)}% OCR accuracy`}
                  • ✓ Ready for search
                </div>
              )}

              {/* Error Status */}
              {doc.status === "failed" && (
                <div className="space-y-2">
                  {doc.processingStatus?.errors && (
                    <div className="text-xs text-red-600">
                      {doc.processingStatus.errors.map((error: string, index: number) => (
                        <div key={index}>⚠ {error}</div>
                      ))}
                    </div>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs"
                    data-testid={`button-reprocess-${doc.id}`}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Reprocess Document
                  </Button>
                </div>
              )}

              {/* Quality Issues */}
              {doc.qualityScore && doc.qualityScore < 0.7 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-xs text-yellow-700 mb-1">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    Quality Issues Detected
                  </div>
                  {doc.metadata?.qualityAssessment?.issues && (
                    <div className="text-xs text-yellow-600">
                      {doc.metadata.qualityAssessment.issues.join(" • ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

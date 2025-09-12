import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  FileText, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Hash,
  ExternalLink,
  Loader2
} from "lucide-react";

interface GoldenSourceDocument {
  id: string;
  sectionNumber: string;
  filename: string;
  sourceUrl: string;
  downloadedAt: string;
  documentHash: string;
  verificationStatus: 'verified' | 'failed' | 'unknown';
  fileSize: number;
  lastModified: string;
}

interface IngestionResponse {
  success: boolean;
  message?: string;
  documentIds?: string[];
  timestamp: string;
  error?: string;
  details?: string;
}

export function DocumentIngestionPanel() {
  const [isIngesting, setIsIngesting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing golden source documents
  const { data: goldenSourceData, isLoading: isLoadingDocuments, refetch: refetchDocuments } = useQuery({
    queryKey: ['/api/golden-source/documents'],
    queryFn: async (): Promise<{ success: boolean; documents: GoldenSourceDocument[]; count: number }> => {
      const response = await fetch('/api/golden-source/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch golden source documents');
      }
      return response.json();
    }
  });

  // Ingestion mutation
  const ingestionMutation = useMutation({
    mutationFn: async (): Promise<IngestionResponse> => {
      setIsIngesting(true);
      const response = await fetch('/api/ingest/maryland-snap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Ingestion failed');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Document Ingestion Complete",
        description: data.message,
      });
      refetchDocuments();
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ingestion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsIngesting(false);
    }
  });

  const documents = goldenSourceData?.documents || [];
  const hasDocuments = documents.length > 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Golden Source Documents
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Official Maryland SNAP policy manual documents with complete audit trails
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasDocuments && (
            <Badge variant="secondary" className="px-3 py-1">
              {documents.length} Documents
            </Badge>
          )}
        </div>
      </div>

      {/* Ingestion Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Document Ingestion
          </CardTitle>
          <CardDescription>
            Download and process all official Maryland SNAP manual documents from the Maryland Department of Human Services website.
            This creates a complete audit trail for compliance and verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {!hasDocuments ? (
              <Alert>
                <FileText className="w-4 h-4" />
                <AlertDescription>
                  No golden source documents found. Click the button below to download all 47+ sections
                  of the Maryland SNAP manual with complete audit trails.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertDescription>
                  {documents.length} golden source documents are currently loaded.
                  You can re-run ingestion to update documents or verify integrity.
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              onClick={() => ingestionMutation.mutate()}
              disabled={isIngesting}
              className="w-fit"
              data-testid="button-ingest-documents"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ingesting Documents...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {hasDocuments ? 'Re-ingest Documents' : 'Start Ingestion'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      {isLoadingDocuments ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading documents...</span>
          </CardContent>
        </Card>
      ) : hasDocuments ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Golden Source Documents
            </CardTitle>
            <CardDescription>
              Official policy documents with verification and audit trails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4" data-testid="documents-list">
              {documents.map((doc, index) => (
                <div key={doc.id}>
                  <div className="flex items-start justify-between py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="shrink-0">
                          Section {doc.sectionNumber}
                        </Badge>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {doc.filename}
                        </h4>
                        <div className="flex items-center gap-1">
                          {doc.verificationStatus === 'verified' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                          )}
                          <span className="text-sm text-gray-500 capitalize">
                            {doc.verificationStatus}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Downloaded: {new Date(doc.downloadedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          <span>Hash: {doc.documentHash.substring(0, 8)}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>Size: {Math.round(doc.fileSize / 1024)}KB</span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <a
                          href={doc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Original Source
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {index < documents.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
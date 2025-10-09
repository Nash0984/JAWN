import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, FileText, Upload, CheckCircle2, AlertCircle, Sparkles, List } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DocumentTemplate {
  id: string;
  documentType: string;
  dhsCategory: string;
  plainLanguageTitle: string;
  explanation: string;
  examples: string[];
  whereToGet: string;
  commonMistakes: string[];
  sortOrder: number;
}

interface ExtractedDocument {
  documentType: string;
  matchedTemplate: DocumentTemplate | null;
  confidence: number;
}

export default function DocumentChecklist() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"simple" | "smart">("simple");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedDocuments, setExtractedDocuments] = useState<ExtractedDocument[]>([]);

  const { data: templates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/public/document-templates"],
  });

  const analyzeNoticeMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await fetch("/api/public/analyze-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      if (!response.ok) throw new Error("Failed to analyze notice");
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedDocuments(data.documents || []);
      toast({
        title: "Notice analyzed",
        description: `Found ${data.documents?.length || 0} document requirements`,
      });
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Could not analyze the notice. Try the simple mode instead.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);
      analyzeNoticeMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  const toggleDocument = (documentId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  };

  const selectedTemplates = templates.filter((t) => selectedDocuments.includes(t.id));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <a href="#checklist-content" className="skip-link">
        Skip to checklist
      </a>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Checklist Generator</h1>
        <p className="text-muted-foreground">
          Find out what documents you need and get clear examples of each one
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "smart")} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="simple" data-testid="tab-simple-mode">
            <List className="h-4 w-4 mr-2" />
            Simple Mode
          </TabsTrigger>
          <TabsTrigger value="smart" data-testid="tab-smart-mode">
            <Sparkles className="h-4 w-4 mr-2" />
            Smart Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Document Types</CardTitle>
              <CardDescription>
                Choose the documents requested in your DHS notice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((template) => (
                    <div
                      key={template.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={template.id}
                        checked={selectedDocuments.includes(template.id)}
                        onCheckedChange={() => toggleDocument(template.id)}
                        data-testid={`checkbox-document-${template.dhsCategory}`}
                      />
                      <label
                        htmlFor={template.id}
                        className="flex-1 cursor-pointer space-y-1"
                      >
                        <div className="font-medium">{template.plainLanguageTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.explanation}
                        </div>
                      </label>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smart" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Upload Your DHS Notice
              </CardTitle>
              <CardDescription>
                Take a photo of your document request notice and we'll tell you what you need
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="notice-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  data-testid="input-notice-upload"
                />
                <label
                  htmlFor="notice-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                    <Upload className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Click to upload notice</p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </label>
              </div>

              {analyzeNoticeMutation.isPending && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Analyzing your notice with AI... This may take a moment.
                  </AlertDescription>
                </Alert>
              )}

              {uploadedImage && !analyzeNoticeMutation.isPending && (
                <div className="space-y-4">
                  <img
                    src={uploadedImage}
                    alt="Uploaded notice"
                    className="max-w-md mx-auto rounded-lg border"
                  />
                  {extractedDocuments.length > 0 && (
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-900 dark:text-green-100">
                        Found {extractedDocuments.length} document requirements in your notice
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated Checklist */}
      {(selectedTemplates.length > 0 || extractedDocuments.length > 0) && (
        <div id="checklist-content" className="space-y-4">
          <h2 className="text-2xl font-bold">Your Document Checklist</h2>

          {mode === "simple"
            ? selectedTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {template.plainLanguageTitle}
                    </CardTitle>
                    <CardDescription>{template.explanation}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Examples (any one of these):</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {template.examples.map((example, idx) => (
                          <li key={idx} className="text-sm">{example}</li>
                        ))}
                      </ul>
                    </div>

                    {template.whereToGet && (
                      <div>
                        <h4 className="font-semibold mb-2">Where to get it:</h4>
                        <p className="text-sm text-muted-foreground">{template.whereToGet}</p>
                      </div>
                    )}

                    {template.commonMistakes && template.commonMistakes.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Common mistakes to avoid:
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {template.commonMistakes.map((mistake, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">{mistake}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            : extractedDocuments.map((doc, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {doc.matchedTemplate?.plainLanguageTitle || doc.documentType}
                      {doc.confidence < 0.8 && (
                        <Badge variant="outline" className="ml-2">
                          Low confidence
                        </Badge>
                      )}
                    </CardTitle>
                    {doc.matchedTemplate && (
                      <CardDescription>{doc.matchedTemplate.explanation}</CardDescription>
                    )}
                  </CardHeader>
                  {doc.matchedTemplate && (
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Examples (any one of these):</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {doc.matchedTemplate.examples.map((example, eidx) => (
                            <li key={eidx} className="text-sm">{example}</li>
                          ))}
                        </ul>
                      </div>

                      {doc.matchedTemplate.whereToGet && (
                        <div>
                          <h4 className="font-semibold mb-2">Where to get it:</h4>
                          <p className="text-sm text-muted-foreground">
                            {doc.matchedTemplate.whereToGet}
                          </p>
                        </div>
                      )}

                      {doc.matchedTemplate.commonMistakes && doc.matchedTemplate.commonMistakes.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Common mistakes to avoid:
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {doc.matchedTemplate.commonMistakes.map((mistake, midx) => (
                              <li key={midx} className="text-sm text-muted-foreground">
                                {mistake}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
        </div>
      )}

      {mode === "simple" && selectedDocuments.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select document types above to see your personalized checklist
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  Download, 
  Search, 
  CheckCircle2, 
  XCircle,
  FileText,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  Link2,
  Sparkles
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PolicyChatWidget } from "@/components/PolicyChatWidget";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ManualSection {
  id: string;
  sectionNumber: string;
  sectionTitle: string;
  category: string;
  sortOrder: number;
  sourceUrl: string;
  fileType: string;
  hasContent: boolean;
  isActive: boolean;
  fileSize?: number;
  lastModified?: string;
}

interface ManualStatus {
  total: number;
  ingested: number;
  withContent: number;
  missing: string[];
  isComplete: boolean;
}

interface SectionDetail {
  section: ManualSection;
  crossReferences: Array<{
    id: string;
    toSectionNumber: string;
    referenceType: string;
    context: string;
  }>;
  chunks: Array<{
    id: string;
    content: string;
    chunkIndex: number;
  }>;
}

export default function PolicyManual() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [useLivingManual, setUseLivingManual] = useState(false);
  const { toast } = useToast();

  // Fetch manual sections
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["/api/manual/sections"],
  });

  // Fetch manual status
  const { data: statusData, isLoading: statusLoading } = useQuery<{ success: boolean } & ManualStatus>({
    queryKey: ["/api/manual/status"],
  });

  // Fetch section details
  const { data: sectionDetailData, isLoading: sectionDetailLoading } = useQuery<{ success: boolean; data: SectionDetail }>({
    queryKey: ["/api/manual/sections", selectedSectionId],
    enabled: !!selectedSectionId,
  });

  // Fetch AI-generated text from Rules as Code
  const generateTextMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await apiRequest("POST", `/api/manual/generate-text/${sectionId}`, {});
      return response.json();
    },
    onError: (error) => {
      toast({
        title: "Text generation failed",
        description: "Could not generate text from Rules as Code. This section may not have associated rules.",
        variant: "destructive",
      });
      console.error("Text generation error:", error);
    },
  });

  // Trigger metadata ingestion
  const ingestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/manual/ingest-metadata", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/manual/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manual/status"] });
      toast({
        title: "Metadata ingested successfully",
        description: `${data.ingested} sections loaded from Maryland DHS website.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Ingestion failed",
        description: "Could not load manual sections. Please try again.",
        variant: "destructive",
      });
      console.error("Ingestion error:", error);
    },
  });

  // Trigger FULL ingestion (download PDFs, extract text, generate embeddings)
  const fullIngestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/manual/ingest-full", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/manual/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manual/status"] });
      toast({
        title: "Full ingestion completed!",
        description: `Processed ${data.sectionsProcessed} sections, created ${data.chunksCreated} chunks, found ${data.crossReferencesExtracted} cross-references.`,
        duration: 10000,
      });
    },
    onError: (error) => {
      toast({
        title: "Full ingestion failed",
        description: "Could not complete manual ingestion. Check console for errors.",
        variant: "destructive",
      });
      console.error("Full ingestion error:", error);
    },
  });

  const sections: ManualSection[] = (sectionsData as any)?.data || [];
  const status: ManualStatus | undefined = statusData;

  // Group sections by category
  const categories = Array.from(new Set(sections.map(s => s.category))).sort();
  const sectionsByCategory = categories.reduce((acc, category) => {
    acc[category] = sections.filter(s => s.category === category);
    return acc;
  }, {} as Record<string, ManualSection[]>);

  // Filter sections
  const filteredSections = sections.filter(section => {
    const matchesSearch = !searchQuery || 
      section.sectionNumber.includes(searchQuery) ||
      section.sectionTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || section.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Maryland SNAP Policy Manual
          </h1>
          <p className="text-muted-foreground">
            Official policy documentation for Maryland's Supplemental Nutrition Assistance Program
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Manual Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : status ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{status.total}</div>
                    <div className="text-sm text-muted-foreground">Total Sections</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{status.ingested}</div>
                    <div className="text-sm text-muted-foreground">Sections Indexed</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{status.withContent}</div>
                    <div className="text-sm text-muted-foreground">Content Loaded</div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{status.missing.length}</div>
                    <div className="text-sm text-muted-foreground">Missing</div>
                  </div>
                </div>

                {status.isComplete ? (
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-900 dark:text-green-100">
                      All {status.total} manual sections are indexed
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                    <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-900 dark:text-yellow-100">
                      {status.missing.length} sections not yet indexed.
                      <Button 
                        variant="link" 
                        onClick={() => ingestMutation.mutate()}
                        disabled={ingestMutation.isPending}
                        className="ml-2 text-yellow-900 dark:text-yellow-100"
                      >
                        {ingestMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>Load now</>
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {status.withContent === 0 && status.ingested > 0 && (
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-900 dark:text-blue-100 flex items-center justify-between">
                      <span>Ready to extract content from {status.ingested} documents and generate embeddings for search?</span>
                      <Button 
                        onClick={() => fullIngestMutation.mutate()}
                        disabled={fullIngestMutation.isPending}
                        size="sm"
                        data-testid="button-full-ingest"
                        className="ml-4"
                      >
                        {fullIngestMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Extract Content & Generate Embeddings
                          </>
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Manual sections not loaded yet</p>
                <Button 
                  onClick={() => ingestMutation.mutate()}
                  disabled={ingestMutation.isPending}
                  data-testid="button-ingest-manual"
                >
                  {ingestMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Loading Manual...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Load Manual Sections
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search and Filters */}
        {sections.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search sections by number or title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-manual"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    data-testid="button-filter-all"
                  >
                    All Sections
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      data-testid={`button-filter-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {category.split(' - ')[0]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Sections by Category */}
        {sectionsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : selectedCategory ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedCategory}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredSections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    data-testid={`section-${section.sectionNumber}`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {section.sectionNumber}
                        </Badge>
                        <span className="font-medium text-foreground">
                          {section.sectionTitle}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {section.hasContent && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {section.fileType}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`button-download-${section.sectionNumber}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {categories.map((category) => (
              <AccordionItem 
                key={category} 
                value={category}
                className="border border-border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-muted">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{category}</span>
                    <Badge variant="secondary">
                      {sectionsByCategory[category].length} sections
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-2 mt-4">
                    {sectionsByCategory[category].map((section) => (
                      <div
                        key={section.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        data-testid={`section-${section.sectionNumber}`}
                        onClick={() => setSelectedSectionId(section.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              {section.sectionNumber}
                            </Badge>
                            <span className="font-medium text-foreground">
                              {section.sectionTitle}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.hasContent && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {section.fileType}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-download-${section.sectionNumber}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Section Detail Dialog */}
      <Dialog open={!!selectedSectionId} onOpenChange={() => setSelectedSectionId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {sectionDetailData?.data.section && (
                  <>
                    <Badge variant="outline" className="font-mono">
                      {sectionDetailData.data.section.sectionNumber}
                    </Badge>
                    <span>{sectionDetailData.data.section.sectionTitle}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="living-manual"
                  checked={useLivingManual}
                  onCheckedChange={(checked) => {
                    setUseLivingManual(checked);
                    if (checked && selectedSectionId && !generateTextMutation.data) {
                      generateTextMutation.mutate(selectedSectionId);
                    }
                  }}
                  data-testid="toggle-living-manual"
                />
                <Label htmlFor="living-manual" className="flex items-center gap-1 cursor-pointer">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm">Living Manual</span>
                </Label>
              </div>
            </DialogTitle>
          </DialogHeader>

          {sectionDetailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : sectionDetailData?.data ? (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Living Manual AI-Generated Content */}
                {useLivingManual ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">AI-Generated Policy Text (from Rules as Code)</h3>
                    </div>
                    {generateTextMutation.isPending ? (
                      <div className="bg-muted p-6 rounded-lg flex items-center justify-center">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Generating text from Rules as Code database...</span>
                      </div>
                    ) : generateTextMutation.data?.success ? (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: generateTextMutation.data.data.content.replace(/\n/g, '<br/>') }} />
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-muted-foreground">
                            Generated from {generateTextMutation.data.data.ruleCount} active rules • 
                            {new Date(generateTextMutation.data.data.generatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Alert>
                        <FileText className="h-4 w-4" />
                        <AlertDescription>
                          No Rules as Code available for this section. This feature works for sections with income limits, deductions, allotments, categorical eligibility, or document requirements.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  /* Original Scraped Content */
                  sectionDetailData.data.chunks.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Section Content</h3>
                      <div className="bg-muted p-4 rounded-lg space-y-3">
                        {sectionDetailData.data.chunks.map((chunk) => (
                          <p key={chunk.id} className="text-sm text-muted-foreground leading-relaxed">
                            {chunk.content}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Content not yet extracted for this section.
                        <Button
                          variant="link"
                          size="sm"
                          asChild
                          className="ml-2"
                        >
                          <a href={sectionDetailData.data.section.sourceUrl} target="_blank" rel="noopener noreferrer">
                            View Original PDF
                          </a>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )
                )}

                {/* Cross-References */}
                {sectionDetailData.data.crossReferences.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Link2 className="h-5 w-5" />
                      Related Sections
                    </h3>
                    <div className="space-y-2">
                      {sectionDetailData.data.crossReferences.map((ref) => {
                        // Find the referenced section to navigate to it
                        const referencedSection = sections.find(s => s.sectionNumber === ref.toSectionNumber);
                        
                        return (
                          <div
                            key={ref.id}
                            className="border border-border rounded-lg p-3 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {ref.referenceType.replace(/_/g, ' ')}
                                  </Badge>
                                  <Badge variant="outline" className="font-mono">
                                    Section {ref.toSectionNumber}
                                  </Badge>
                                </div>
                                {ref.context && (
                                  <p className="text-sm text-muted-foreground italic">
                                    "{ref.context}"
                                  </p>
                                )}
                              </div>
                              {referencedSection ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSectionId(null);
                                    setTimeout(() => setSelectedSectionId(referencedSection.id), 100);
                                  }}
                                  data-testid={`button-navigate-${ref.toSectionNumber}`}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Not Found
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
      <PolicyChatWidget context="policy-manual" />
    </div>
  );
}

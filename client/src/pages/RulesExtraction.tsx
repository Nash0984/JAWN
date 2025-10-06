import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  FileText, 
  Sparkles,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ManualSection {
  id: string;
  sectionNumber: string;
  sectionTitle: string;
  category: string;
  parentSection?: string;
  isActive: boolean;
}

interface ExtractionJob {
  id: string;
  manualSectionId: string;
  sectionNumber: string;
  sectionTitle: string;
  extractionType: string;
  status: string;
  rulesExtracted?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export default function RulesExtraction() {
  const { toast } = useToast();
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [extractionType, setExtractionType] = useState<string>("full_auto");

  // Fetch all manual sections
  const { data: sections = [], isLoading: loadingSections } = useQuery<ManualSection[]>({
    queryKey: ['/api/manual/sections'],
  });

  // Fetch all extraction jobs
  const { data: jobs = [], isLoading: loadingJobs } = useQuery<ExtractionJob[]>({
    queryKey: ['/api/extraction/jobs'],
  });

  // Single section extraction mutation
  const extractSectionMutation = useMutation({
    mutationFn: async ({ manualSectionId, extractionType }: { manualSectionId: string; extractionType?: string }) => {
      return await apiRequest("POST", '/api/extraction/extract-section', { manualSectionId, extractionType }) as Promise<any>;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Extraction Started",
        description: `Extraction job created. ${data.rulesExtracted} rules extracted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract rules",
        variant: "destructive",
      });
    },
  });

  // Batch extraction mutation
  const batchExtractMutation = useMutation({
    mutationFn: async ({ manualSectionIds }: { manualSectionIds: string[] }) => {
      return await apiRequest("POST", '/api/extraction/extract-batch', { manualSectionIds }) as Promise<any>;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Batch Extraction Complete",
        description: `Extracted ${data.totalRulesExtracted} rules from ${data.successfulExtractions} sections.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/extraction/jobs'] });
      setSelectedSections([]);
    },
    onError: (error) => {
      toast({
        title: "Batch Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract rules",
        variant: "destructive",
      });
    },
  });

  const handleExtractSection = (sectionId: string) => {
    extractSectionMutation.mutate({ manualSectionId: sectionId, extractionType });
  };

  const handleBatchExtract = () => {
    if (selectedSections.length === 0) {
      toast({
        title: "No Sections Selected",
        description: "Please select at least one section to extract",
        variant: "destructive",
      });
      return;
    }
    batchExtractMutation.mutate({ manualSectionIds: selectedSections });
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const selectAllSections = () => {
    setSelectedSections(sections.map(s => s.id));
  };

  const clearSelection = () => {
    setSelectedSections([]);
  };

  const getExtractionStatus = (sectionId: string): 'pending' | 'processing' | 'completed' | 'failed' => {
    const sectionJobs = jobs.filter(j => j.manualSectionId === sectionId);
    if (sectionJobs.length === 0) return 'pending';
    
    const latestJob = sectionJobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    return latestJob.status as 'pending' | 'processing' | 'completed' | 'failed';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "outline", icon: Clock, label: "Pending" },
      processing: { variant: "secondary", icon: RefreshCw, label: "Processing" },
      completed: { variant: "default", icon: CheckCircle, label: "Completed" },
      failed: { variant: "destructive", icon: XCircle, label: "Failed" },
    };
    
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getRulesCount = (sectionId: string): number => {
    const sectionJobs = jobs.filter(j => j.manualSectionId === sectionId && j.status === 'completed');
    if (sectionJobs.length === 0) return 0;
    
    const latestJob = sectionJobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    return latestJob.rulesExtracted || 0;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="page-title">
          Rules Extraction Pipeline
        </h1>
        <p className="text-muted-foreground">
          Extract structured rules from policy manual sections using AI
        </p>
      </div>

      <Tabs defaultValue="sections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sections" data-testid="tab-sections">
            <FileText className="h-4 w-4 mr-2" />
            Manual Sections
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Database className="h-4 w-4 mr-2" />
            Extraction Jobs
          </TabsTrigger>
        </TabsList>

        {/* Manual Sections Tab */}
        <TabsContent value="sections" className="space-y-6">
          {/* Extraction Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Extraction Controls
              </CardTitle>
              <CardDescription>
                Select sections and extraction type to begin processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Extraction Type</label>
                  <Select value={extractionType} onValueChange={setExtractionType}>
                    <SelectTrigger data-testid="select-extraction-type">
                      <SelectValue placeholder="Select extraction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_auto">Full Auto-Detect</SelectItem>
                      <SelectItem value="income_limits">Income Limits Only</SelectItem>
                      <SelectItem value="deductions">Deductions Only</SelectItem>
                      <SelectItem value="allotments">Allotments Only</SelectItem>
                      <SelectItem value="categorical_eligibility">Categorical Eligibility</SelectItem>
                      <SelectItem value="document_requirements">Document Requirements</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Button 
                    onClick={selectAllSections} 
                    variant="outline"
                    data-testid="button-select-all"
                  >
                    Select All
                  </Button>
                  <Button 
                    onClick={clearSelection} 
                    variant="outline"
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                  <Button 
                    onClick={handleBatchExtract}
                    disabled={selectedSections.length === 0 || batchExtractMutation.isPending}
                    data-testid="button-batch-extract"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Extract Selected ({selectedSections.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sections Table */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Sections</CardTitle>
              <CardDescription>
                Select sections to extract rules from
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSections ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading sections...
                </div>
              ) : sections.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No manual sections available for extraction</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rules</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section) => {
                      const status = getExtractionStatus(section.id);
                      const rulesCount = getRulesCount(section.id);
                      
                      return (
                        <TableRow key={section.id} data-testid={`row-section-${section.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSections.includes(section.id)}
                              onCheckedChange={() => toggleSection(section.id)}
                              data-testid={`checkbox-section-${section.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono" data-testid={`text-section-number-${section.id}`}>
                            {section.sectionNumber}
                          </TableCell>
                          <TableCell data-testid={`text-section-title-${section.id}`}>
                            {section.sectionTitle}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(status)}
                          </TableCell>
                          <TableCell data-testid={`text-rules-count-${section.id}`}>
                            {rulesCount > 0 ? (
                              <span className="text-sm font-medium">{rulesCount} rules</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExtractSection(section.id)}
                              disabled={extractSectionMutation.isPending}
                              data-testid={`button-extract-${section.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Extract
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extraction Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extraction Job History</CardTitle>
              <CardDescription>
                View all extraction jobs and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingJobs ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading jobs...
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No extraction jobs yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rules Extracted</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                        <TableCell className="font-mono text-xs" data-testid={`text-job-id-${job.id}`}>
                          {job.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell data-testid={`text-job-section-${job.id}`}>
                          {job.sectionNumber} - {job.sectionTitle}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.extractionType}</Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell data-testid={`text-job-rules-${job.id}`}>
                          {job.rulesExtracted || 0} rules
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

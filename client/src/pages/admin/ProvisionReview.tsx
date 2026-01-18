import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText, 
  Scale,
  Clock,
  ChevronRight,
  Eye,
  BarChart3,
  History,
  ArrowRight
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type MappingStats = {
  pending: number;
  approved: number;
  rejected: number;
  byPriority: Record<string, number>;
};

type ProvisionMapping = {
  mapping: {
    id: string;
    lawProvisionId: string;
    ontologyTermId: string;
    mappingType: string;
    mappingReason: string;
    impactDescription: string;
    matchMethod: string;
    citationMatchScore: number | null;
    semanticSimilarityScore: number | null;
    aiConfidenceScore: number | null;
    reviewStatus: string;
    priorityLevel: string;
    createdAt: string;
  };
  provision: {
    id: string;
    sectionNumber: string | null;
    sectionTitle: string | null;
    provisionType: string;
    provisionText: string;
    provisionSummary: string | null;
    usCodeCitation: string | null;
    affectedPrograms: string[] | null;
    effectiveDate: string | null;
    publicLawId: string;
  };
  term: {
    id: string;
    termName: string;
    canonicalName: string;
    domain: string;
    definition: string | null;
    statutoryCitation: string | null;
    programCode: string;
  };
};

type PendingMappingsResponse = {
  mappings: ProvisionMapping[];
  total: number;
  limit: number;
  offset: number;
};

type DetailedMapping = ProvisionMapping & {
  publicLaw?: {
    id: string;
    publicLawNumber: string;
    title: string;
    enactmentDate: string | null;
  };
  relatedRules?: {
    id: string;
    ruleName: string;
    programCode: string;
    status: string;
  }[];
};

export default function ProvisionReview() {
  const { toast } = useToast();
  const [selectedMapping, setSelectedMapping] = useState<ProvisionMapping | null>(null);
  const [detailedMapping, setDetailedMapping] = useState<DetailedMapping | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<MappingStats>({
    queryKey: ['/api/provision-mappings/stats'],
  });

  const { data: pendingData, isLoading: pendingLoading, refetch } = useQuery<PendingMappingsResponse>({
    queryKey: ['/api/provision-mappings/pending', priorityFilter],
    queryFn: () => fetch(`/api/provision-mappings/pending${priorityFilter !== 'all' ? `?priority=${priorityFilter}` : ''}`).then(res => res.json()),
  });

  const { data: approvedData } = useQuery<{ mappings: ProvisionMapping[] }>({
    queryKey: ['/api/provision-mappings/history/approved'],
  });

  const invalidateAllMappingQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/provision-mappings/stats'] });
    queryClient.invalidateQueries({ queryKey: ['/api/provision-mappings/pending'] });
    queryClient.invalidateQueries({ queryKey: ['/api/provision-mappings/history/approved'] });
  };

  const approveMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      return await apiRequest('POST', `/api/provision-mappings/${mappingId}/approve`, {});
    },
    onSuccess: (data: any) => {
      const message = data.requiresRuleVerification 
        ? `Mapping approved. ${data.affectedRules} rules queued for verification.`
        : "Mapping approved and applied.";
      toast({ title: "Approved", description: message });
      invalidateAllMappingQueries();
      setIsDetailOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ mappingId, reason }: { mappingId: string; reason: string }) => {
      return await apiRequest('POST', `/api/provision-mappings/${mappingId}/reject`, { rejectionReason: reason });
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Mapping has been rejected." });
      invalidateAllMappingQueries();
      setIsRejectDialogOpen(false);
      setIsDetailOpen(false);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (mappingIds: string[]) => {
      return await apiRequest('POST', '/api/provision-mappings/bulk-approve', { mappingIds });
    },
    onSuccess: (data: any) => {
      toast({ title: "Bulk Approved", description: `${data.approvedCount} mappings approved.` });
      invalidateAllMappingQueries();
      setSelectedForBulk(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const openMappingDetail = async (item: ProvisionMapping) => {
    setSelectedMapping(item);
    setDetailedMapping(null);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    
    try {
      const response = await fetch(`/api/provision-mappings/${item.mapping.id}`);
      if (response.ok) {
        const data = await response.json();
        setDetailedMapping(data);
      }
    } catch (error) {
      console.error("Failed to fetch mapping details:", error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const pendingMappings = pendingData?.mappings || [];
  const approvedMappings = approvedData?.mappings || [];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent": return <Badge variant="destructive">Urgent</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "normal": return <Badge variant="secondary">Normal</Badge>;
      case "low": return <Badge variant="outline">Low</Badge>;
      default: return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getMappingTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      amends: "bg-blue-500",
      supersedes: "bg-purple-500",
      adds_exception: "bg-yellow-500",
      modifies_threshold: "bg-green-500",
      clarifies: "bg-gray-500",
      removes: "bg-red-500",
      creates: "bg-teal-500"
    };
    return <Badge className={colors[type] || "bg-gray-500"}>{type.replace('_', ' ')}</Badge>;
  };

  const getConfidenceColor = (score: number | null) => {
    if (!score) return "text-gray-400";
    if (score >= 0.9) return "text-green-600";
    if (score >= 0.75) return "text-yellow-600";
    return "text-red-600";
  };

  const toggleBulkSelect = (id: string) => {
    const newSet = new Set(selectedForBulk);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedForBulk(newSet);
  };

  const selectAllVisible = () => {
    const allIds = new Set(pendingMappings.map(m => m.mapping.id));
    setSelectedForBulk(allIds);
  };

  const deselectAll = () => {
    setSelectedForBulk(new Set());
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Provision Mapping Review</h1>
        <p className="text-muted-foreground">
          Review AI-proposed mappings between legislative provisions and the legal ontology
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-3xl font-bold">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats?.approved || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats?.rejected || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.byPriority?.urgent || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Review ({stats?.pending || 0})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Approved History
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Review Queue</CardTitle>
                  <CardDescription>AI-proposed mappings awaiting human validation</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    className="border rounded px-2 py-1 text-sm"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent Only</option>
                    <option value="high">High Priority</option>
                    <option value="normal">Normal</option>
                  </select>
                  {selectedForBulk.size > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        Clear ({selectedForBulk.size})
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => bulkApproveMutation.mutate(Array.from(selectedForBulk))}
                        disabled={bulkApproveMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve Selected
                      </Button>
                    </>
                  )}
                  {selectedForBulk.size === 0 && pendingMappings.length > 0 && (
                    <Button variant="outline" size="sm" onClick={selectAllVisible}>
                      Select All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : pendingMappings.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-12 w-12 text-green-500" />}
                  title="All caught up!"
                  description="No pending mappings to review. New mappings will appear here when laws are synced."
                />
              ) : (
                <div className="space-y-3">
                  {pendingMappings.map((item) => (
                    <div 
                      key={item.mapping.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openMappingDetail(item)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedForBulk.has(item.mapping.id)}
                            onCheckedChange={() => toggleBulkSelect(item.mapping.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getPriorityBadge(item.mapping.priorityLevel)}
                              {getMappingTypeBadge(item.mapping.mappingType)}
                              <Badge variant="outline">{item.mapping.matchMethod.replace('_', ' ')}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.provision.sectionNumber || 'Section'}</span>
                              {item.provision.usCodeCitation && (
                                <span className="text-muted-foreground">({item.provision.usCodeCitation})</span>
                              )}
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Scale className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.term.termName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.mapping.mappingReason}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${getConfidenceColor(item.mapping.aiConfidenceScore)}`}>
                            {item.mapping.aiConfidenceScore 
                              ? `${(item.mapping.aiConfidenceScore * 100).toFixed(0)}%` 
                              : 'N/A'}
                          </span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Mappings</CardTitle>
              <CardDescription>Recently approved provision-to-ontology mappings</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedMappings.length === 0 ? (
                <EmptyState
                  icon={<History className="h-12 w-12" />}
                  title="No approved mappings yet"
                  description="Approved mappings will appear here for audit trail purposes."
                />
              ) : (
                <div className="space-y-2">
                  {approvedMappings.slice(0, 20).map((item) => (
                    <div key={item.mapping.id} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{item.provision.sectionNumber}</span>
                          <ArrowRight className="h-4 w-4" />
                          <span>{item.term.termName}</span>
                        </div>
                        {getMappingTypeBadge(item.mapping.mappingType)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Review Analytics</CardTitle>
              <CardDescription>Mapping statistics and review metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold text-green-600">{stats?.approved || 0}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold text-red-600">{stats?.rejected || 0}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
                <div className="text-center p-4 border rounded">
                  <p className="text-2xl font-bold">
                    {stats?.approved && stats?.rejected 
                      ? ((stats.approved / (stats.approved + stats.rejected)) * 100).toFixed(0)
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Approval Rate</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3">Pending by Priority</h4>
                <div className="space-y-2">
                  {Object.entries(stats?.byPriority || {}).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <span className="capitalize">{priority}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Mapping</DialogTitle>
            <DialogDescription>
              Verify this AI-proposed mapping before applying to the rules engine
            </DialogDescription>
          </DialogHeader>

          {selectedMapping && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Legislative Provision
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">Section</Label>
                      <p className="font-medium">{selectedMapping.provision.sectionNumber || 'N/A'}</p>
                    </div>
                    {selectedMapping.provision.sectionTitle && (
                      <div>
                        <Label className="text-muted-foreground">Title</Label>
                        <p className="font-medium">{selectedMapping.provision.sectionTitle}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground">U.S. Code Citation</Label>
                      <p className="font-medium">{selectedMapping.provision.usCodeCitation || 'Not specified'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p>{selectedMapping.provision.provisionType}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Programs Affected</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedMapping.provision.affectedPrograms?.map(p => (
                          <Badge key={p} variant="outline">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Summary</Label>
                      <p className="text-sm">{selectedMapping.provision.provisionSummary || 'No summary available'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Full Text</Label>
                      <p className="text-sm bg-muted p-2 rounded max-h-40 overflow-y-auto">
                        {selectedMapping.provision.provisionText}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      Ontology Term
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">Term Name</Label>
                      <p className="font-medium">{selectedMapping.term.termName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Canonical Name</Label>
                      <p className="font-mono text-sm">{selectedMapping.term.canonicalName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Domain</Label>
                      <Badge variant="secondary">{selectedMapping.term.domain}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Program</Label>
                      <Badge>{selectedMapping.term.programCode}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Statutory Citation</Label>
                      <p className="text-sm">{selectedMapping.term.statutoryCitation || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Definition</Label>
                      <p className="text-sm bg-muted p-2 rounded">
                        {selectedMapping.term.definition || 'No definition available'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">AI Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    {getPriorityBadge(selectedMapping.mapping.priorityLevel)}
                    {getMappingTypeBadge(selectedMapping.mapping.mappingType)}
                    <Badge variant="outline">{selectedMapping.mapping.matchMethod.replace('_', ' ')}</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Mapping Reason</Label>
                    <p className="text-sm">{selectedMapping.mapping.mappingReason}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Expected Impact</Label>
                    <p className="text-sm">{selectedMapping.mapping.impactDescription || 'No impact description'}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <Label className="text-muted-foreground">AI Confidence</Label>
                      <p className={`font-medium ${getConfidenceColor(selectedMapping.mapping.aiConfidenceScore)}`}>
                        {selectedMapping.mapping.aiConfidenceScore 
                          ? `${(selectedMapping.mapping.aiConfidenceScore * 100).toFixed(0)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    {selectedMapping.mapping.citationMatchScore && (
                      <div>
                        <Label className="text-muted-foreground">Citation Match</Label>
                        <p className="font-medium">{(selectedMapping.mapping.citationMatchScore * 100).toFixed(0)}%</p>
                      </div>
                    )}
                    {selectedMapping.mapping.semanticSimilarityScore && (
                      <div>
                        <Label className="text-muted-foreground">Semantic Similarity</Label>
                        <p className="font-medium">{(selectedMapping.mapping.semanticSimilarityScore * 100).toFixed(0)}%</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {isLoadingDetail && (
                <div className="text-center py-4 text-muted-foreground">
                  Loading additional context...
                </div>
              )}

              {detailedMapping?.publicLaw && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Source Public Law</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4">
                      <div>
                        <Label className="text-muted-foreground">Law Number</Label>
                        <p className="font-medium">Public Law {detailedMapping.publicLaw.publicLawNumber}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Title</Label>
                        <p className="font-medium">{detailedMapping.publicLaw.title}</p>
                      </div>
                      {detailedMapping.publicLaw.enactmentDate && (
                        <div>
                          <Label className="text-muted-foreground">Enactment Date</Label>
                          <p className="font-medium">{new Date(detailedMapping.publicLaw.enactmentDate).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {detailedMapping?.relatedRules && detailedMapping.relatedRules.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Rules That Will Require Re-Verification ({detailedMapping.relatedRules.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {detailedMapping.relatedRules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between border rounded p-2">
                          <div>
                            <p className="font-medium">{rule.ruleName}</p>
                            <Badge variant="outline">{rule.programCode}</Badge>
                          </div>
                          <Badge variant={rule.status === "approved" ? "default" : "secondary"}>
                            {rule.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      These rules will be queued for human review after approval to ensure they remain valid under the updated law.
                    </p>
                  </CardContent>
                </Card>
              )}

              <DialogFooter>
                <Button 
                  variant="destructive" 
                  onClick={() => setIsRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  onClick={() => approveMutation.mutate(selectedMapping.mapping.id)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Mapping
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Mapping</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this mapping. This helps improve future AI proposals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Incorrect citation match, term not affected by this provision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedMapping) {
                  rejectMutation.mutate({ 
                    mappingId: selectedMapping.mapping.id, 
                    reason: rejectionReason 
                  });
                }
              }}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

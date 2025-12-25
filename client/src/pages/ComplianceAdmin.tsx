import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Plus,
  Edit,
  Trash2,
  Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ComplianceRule {
  id: string;
  ruleCode: string;
  title: string;
  description: string;
  ruleType: string;
  category: string;
  severityLevel: string;
  sourceRegulation?: string;
  isActive: boolean;
  createdAt: string;
}

interface ComplianceViolation {
  id: string;
  complianceRuleId: string;
  violationType: string;
  severity: string;
  entityType: string;
  entityId?: string;
  detectedValue?: string;
  expectedValue?: string;
  aiAnalysis?: string;
  confidenceScore?: number;
  status: string;
  resolution?: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

const severityColors = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500"
};

const statusColors = {
  open: "bg-red-500",
  acknowledged: "bg-yellow-500",
  resolved: "bg-green-500",
  dismissed: "bg-gray-500"
};

export function ComplianceAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRule, setSelectedRule] = useState<ComplianceRule | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [violationFilter, setViolationFilter] = useState<string>("open");

  // Fetch compliance rules
  const { data: rules, isLoading: rulesLoading } = useQuery<ComplianceRule[]>({
    queryKey: ["/api/compliance-rules", ruleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ruleFilter && ruleFilter !== 'all') {
        params.append('ruleType', ruleFilter);
      }
      const url = `/api/compliance-rules${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch rules');
      return response.json();
    },
    enabled: !!user
  });

  // Fetch compliance violations
  const { data: violations, isLoading: violationsLoading } = useQuery<ComplianceViolation[]>({
    queryKey: ["/api/compliance-violations", violationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (violationFilter) {
        params.append('status', violationFilter);
      }
      const url = `/api/compliance-violations${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch violations');
      return response.json();
    },
    enabled: !!user
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest("DELETE", `/api/compliance-rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-rules"] });
      toast({ title: "Rule deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    }
  });

  // Acknowledge violation mutation
  const acknowledgeViolationMutation = useMutation({
    mutationFn: async (violationId: string) => {
      return await apiRequest("PATCH", `/api/compliance-violations/${violationId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-violations"] });
      toast({ title: "Violation acknowledged" });
    },
    onError: () => {
      toast({ title: "Failed to acknowledge violation", variant: "destructive" });
    }
  });

  // Resolve violation mutation
  const resolveViolationMutation = useMutation({
    mutationFn: async ({ violationId, resolution }: { violationId: string; resolution: string }) => {
      return await apiRequest("PATCH", `/api/compliance-violations/${violationId}/resolve`, { resolution });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-violations"] });
      setSelectedViolation(null);
      toast({ title: "Violation resolved" });
    },
    onError: () => {
      toast({ title: "Failed to resolve violation", variant: "destructive" });
    }
  });

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            You don't have permission to access this page. Admin access required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-compliance">Compliance Assurance</h1>
          <p className="text-muted-foreground">
            Manage compliance rules and review violations
          </p>
        </div>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList data-testid="tabs-compliance">
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Shield className="h-4 w-4 mr-2" />
            Compliance Rules
          </TabsTrigger>
          <TabsTrigger value="violations" data-testid="tab-violations">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Violations
          </TabsTrigger>
        </TabsList>

        {/* Compliance Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Compliance Rules</CardTitle>
                  <CardDescription>Regulatory requirements and validation rules</CardDescription>
                </div>
                <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-rule">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Compliance Rule</DialogTitle>
                      <DialogDescription>
                        Define a new regulatory compliance rule
                      </DialogDescription>
                    </DialogHeader>
                    <CreateRuleForm onClose={() => setIsCreateRuleOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Select value={ruleFilter} onValueChange={setRuleFilter}>
                  <SelectTrigger className="w-48" data-testid="select-rule-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rules</SelectItem>
                    <SelectItem value="federal_regulation">Federal Regulation</SelectItem>
                    <SelectItem value="state_regulation">State Regulation</SelectItem>
                    <SelectItem value="policy_content">Policy Content</SelectItem>
                    <SelectItem value="data_quality">Data Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rulesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules?.map((rule) => (
                      <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                        <TableCell className="font-mono text-sm">{rule.ruleCode}</TableCell>
                        <TableCell className="font-medium">{rule.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.ruleType.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{rule.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[rule.severityLevel as keyof typeof severityColors]}>
                            {rule.severityLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRule(rule)}
                              data-testid={`button-view-rule-${rule.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              disabled={deleteRuleMutation.isPending}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Violations</CardTitle>
              <CardDescription>Detected regulatory compliance issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Select value={violationFilter} onValueChange={setViolationFilter}>
                  <SelectTrigger className="w-48" data-testid="select-violation-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {violationsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Detected</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {violations?.map((violation) => (
                      <TableRow key={violation.id} data-testid={`row-violation-${violation.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{violation.entityType}</div>
                            {violation.entityId && (
                              <div className="text-sm text-muted-foreground">ID: {violation.entityId}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{violation.violationType.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[violation.severity as keyof typeof severityColors]}>
                            {violation.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[violation.status as keyof typeof statusColors]}>
                            {violation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {violation.confidenceScore && (
                            <span className="text-sm">{(violation.confidenceScore * 100).toFixed(0)}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(violation.detectedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedViolation(violation)}
                              data-testid={`button-view-violation-${violation.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {violation.status === 'open' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => acknowledgeViolationMutation.mutate(violation.id)}
                                disabled={acknowledgeViolationMutation.isPending}
                                data-testid={`button-acknowledge-violation-${violation.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Rule Details Dialog */}
      {selectedRule && (
        <Dialog open={!!selectedRule} onOpenChange={() => setSelectedRule(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedRule.title}</DialogTitle>
              <DialogDescription className="font-mono">{selectedRule.ruleCode}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="text-sm text-muted-foreground mt-1">{selectedRule.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rule Type</Label>
                  <p className="text-sm mt-1">{selectedRule.ruleType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <Label>Category</Label>
                  <p className="text-sm mt-1">{selectedRule.category}</p>
                </div>
                <div>
                  <Label>Severity Level</Label>
                  <Badge className={severityColors[selectedRule.severityLevel as keyof typeof severityColors]}>
                    {selectedRule.severityLevel}
                  </Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  {selectedRule.isActive ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
              {selectedRule.sourceRegulation && (
                <div>
                  <Label>Source Regulation</Label>
                  <p className="text-sm mt-1">{selectedRule.sourceRegulation}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Violation Details Dialog */}
      {selectedViolation && (
        <Dialog open={!!selectedViolation} onOpenChange={() => setSelectedViolation(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Violation Details</DialogTitle>
              <DialogDescription>{selectedViolation.entityType} - {selectedViolation.violationType}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Severity</Label>
                  <Badge className={severityColors[selectedViolation.severity as keyof typeof severityColors]}>
                    {selectedViolation.severity}
                  </Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={statusColors[selectedViolation.status as keyof typeof statusColors]}>
                    {selectedViolation.status}
                  </Badge>
                </div>
                <div>
                  <Label>Confidence</Label>
                  <p className="text-sm">{selectedViolation.confidenceScore && (selectedViolation.confidenceScore * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <Label>Detected</Label>
                  <p className="text-sm">{new Date(selectedViolation.detectedAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedViolation.aiAnalysis && (
                <div>
                  <Label>AI Analysis</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedViolation.aiAnalysis}</p>
                </div>
              )}

              {(selectedViolation.detectedValue || selectedViolation.expectedValue) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedViolation.detectedValue && (
                    <div>
                      <Label>Detected Value</Label>
                      <p className="text-sm mt-1 font-mono">{selectedViolation.detectedValue}</p>
                    </div>
                  )}
                  {selectedViolation.expectedValue && (
                    <div>
                      <Label>Expected Value</Label>
                      <p className="text-sm mt-1 font-mono">{selectedViolation.expectedValue}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedViolation.status === 'open' || selectedViolation.status === 'acknowledged' && (
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  <Textarea
                    id="resolution"
                    placeholder="Describe how this violation was resolved..."
                    className="mt-1"
                    data-testid="input-resolution"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => {
                        const resolution = (document.getElementById('resolution') as HTMLTextAreaElement)?.value;
                        if (resolution) {
                          resolveViolationMutation.mutate({ 
                            violationId: selectedViolation.id, 
                            resolution 
                          });
                        }
                      }}
                      disabled={resolveViolationMutation.isPending}
                      data-testid="button-resolve-violation"
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              )}

              {selectedViolation.resolution && (
                <div>
                  <Label>Resolution</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedViolation.resolution}</p>
                  {selectedViolation.resolvedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Resolved on {new Date(selectedViolation.resolvedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateRuleForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    ruleCode: '',
    title: '',
    description: '',
    ruleType: 'federal_regulation',
    category: 'eligibility',
    severityLevel: 'medium',
    validationPrompt: '',
    sourceRegulation: ''
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/compliance-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-rules"] });
      toast({ title: "Rule created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create rule", variant: "destructive" });
    }
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createRuleMutation.mutate(formData);
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ruleCode">Rule Code *</Label>
          <Input
            id="ruleCode"
            value={formData.ruleCode}
            onChange={(e) => setFormData({ ...formData, ruleCode: e.target.value })}
            placeholder="SNAP_FED_273.2"
            required
            data-testid="input-rule-code"
          />
        </div>
        <div>
          <Label htmlFor="category">Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eligibility">Eligibility</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="deductions">Deductions</SelectItem>
              <SelectItem value="reporting">Reporting</SelectItem>
              <SelectItem value="verification">Verification</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Income calculation must match federal guidelines"
          required
          data-testid="input-title"
        />
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed description of the compliance requirement..."
          required
          data-testid="input-description"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="ruleType">Rule Type *</Label>
          <Select value={formData.ruleType} onValueChange={(value) => setFormData({ ...formData, ruleType: value })}>
            <SelectTrigger data-testid="select-rule-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="federal_regulation">Federal Regulation</SelectItem>
              <SelectItem value="state_regulation">State Regulation</SelectItem>
              <SelectItem value="policy_content">Policy Content</SelectItem>
              <SelectItem value="data_quality">Data Quality</SelectItem>
              <SelectItem value="process_compliance">Process Compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="severityLevel">Severity *</Label>
          <Select value={formData.severityLevel} onValueChange={(value) => setFormData({ ...formData, severityLevel: value })}>
            <SelectTrigger data-testid="select-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sourceRegulation">Source</Label>
          <Input
            id="sourceRegulation"
            value={formData.sourceRegulation}
            onChange={(e) => setFormData({ ...formData, sourceRegulation: e.target.value })}
            placeholder="7 CFR 273.2"
            data-testid="input-source"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="validationPrompt">Validation Prompt *</Label>
        <Textarea
          id="validationPrompt"
          value={formData.validationPrompt}
          onChange={(e) => setFormData({ ...formData, validationPrompt: e.target.value })}
          placeholder="Gemini prompt for validating this rule..."
          rows={4}
          required
          data-testid="input-validation-prompt"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createRuleMutation.isPending} data-testid="button-submit-rule">
          {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

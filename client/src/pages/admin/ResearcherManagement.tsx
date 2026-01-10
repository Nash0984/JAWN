import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  BarChart3,
  Clock,
  Activity,
  Users,
  FileText
} from "lucide-react";
import { format } from "date-fns";

interface ApiKey {
  id: string;
  name: string;
  tenantId: string;
  scopes: string[];
  rateLimit: number;
  status: string;
  lastUsedAt: string | null;
  requestCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface UsageStats {
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgResponseTime: number;
}

const RESEARCH_SCOPES = [
  { value: "research:eligibility", label: "Eligibility Statistics", description: "Aggregated eligibility calculation data" },
  { value: "research:outcomes", label: "Program Outcomes", description: "Case outcome statistics by status" },
  { value: "research:demographics", label: "Demographics", description: "Household size and income distributions" },
  { value: "research:perm", label: "PERM Data", description: "Federal payment error rate sampling" },
  { value: "research:all", label: "All Research Data", description: "Full access to all research endpoints" },
];

export default function ResearcherManagement() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    tenantId: "research",
    scopes: [] as string[],
    rateLimit: 100,
    expiresInDays: 365,
  });

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/admin/api-keys'],
  });

  const researchKeys = apiKeys?.filter(key => 
    (key.scopes as string[]).some(scope => scope.startsWith('research:'))
  ) || [];

  const { data: usageStats } = useQuery<UsageStats>({
    queryKey: ['/api/admin/api-keys', selectedKey?.id, 'stats'],
    enabled: !!selectedKey,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);
      
      return await apiRequest('/api/admin/api-keys', 'POST', {
        name: data.name,
        tenantId: data.tenantId,
        scopes: data.scopes,
        rateLimit: data.rateLimit,
        expiresAt: expiresAt.toISOString(),
      });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      setShowNewKey(response.key);
      setFormData({ name: "", tenantId: "research", scopes: [], rateLimit: 100, expiresInDays: 365 });
      toast({
        title: "API Key Created",
        description: "The researcher API key has been generated. Make sure to copy it now - it won't be shown again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest(`/api/admin/api-keys/${keyId}/revoke`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      setDeleteDialogOpen(false);
      setSelectedKey(null);
      toast({
        title: "API Key Revoked",
        description: "The researcher API key has been revoked and can no longer be used.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const handleScopeToggle = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case 'suspended':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
      case 'revoked':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8" />
            Researcher API Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys for external research partners with PII-protected data access
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Research API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Research API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for research partner access. All data accessed through this key is PII-stripped and aggregated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., University of Maryland Research Team"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data Access Scopes</Label>
                <div className="space-y-2 border rounded-lg p-3">
                  {RESEARCH_SCOPES.map((scope) => (
                    <div key={scope.value} className="flex items-start space-x-3">
                      <Checkbox
                        id={scope.value}
                        checked={formData.scopes.includes(scope.value)}
                        onCheckedChange={() => handleScopeToggle(scope.value)}
                      />
                      <div className="grid gap-0.5">
                        <label htmlFor={scope.value} className="text-sm font-medium cursor-pointer">
                          {scope.label}
                        </label>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">Rate Limit (req/hour)</Label>
                  <Select
                    value={formData.rateLimit.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, rateLimit: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50 requests/hour</SelectItem>
                      <SelectItem value="100">100 requests/hour</SelectItem>
                      <SelectItem value="500">500 requests/hour</SelectItem>
                      <SelectItem value="1000">1000 requests/hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expires">Expiration</Label>
                  <Select
                    value={formData.expiresInDays.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, expiresInDays: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">6 months</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || formData.scopes.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Generate API Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {showNewKey && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Shield className="w-5 h-5" />
              New API Key Created
            </CardTitle>
            <CardDescription className="text-green-700">
              Copy this key now - it will not be shown again. Share it securely with the research partner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-white rounded border font-mono text-sm">
              <code className="flex-1 break-all">{showNewKey}</code>
              <Button variant="ghost" size="sm" onClick={() => handleCopyKey(showNewKey)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              className="mt-3" 
              onClick={() => {
                setShowNewKey(null);
                setCreateDialogOpen(false);
              }}
            >
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Researchers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {researchKeys.filter(k => k.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">with API access</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total API Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {researchKeys.reduce((sum, k) => sum + k.requestCount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {researchKeys.length > 0 && researchKeys.some(k => k.lastUsedAt) 
                ? format(new Date(Math.max(...researchKeys.filter(k => k.lastUsedAt).map(k => new Date(k.lastUsedAt!).getTime()))), 'MMM d')
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">most recent request</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              API Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="link" className="p-0 h-auto text-blue-600" asChild>
              <a href="/api/research/docs" target="_blank" rel="noopener noreferrer">
                View Docs
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">for researchers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Controls</TabsTrigger>
        </TabsList>
        
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Research API Keys</CardTitle>
              <CardDescription>
                Manage API keys issued to external research partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : researchKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No research API keys created yet. Click "Create Research API Key" to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Rate Limit</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {researchKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(key.scopes as string[]).filter(s => s.startsWith('research:')).map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-xs">
                                {scope.replace('research:', '')}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{key.rateLimit}/hr</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{key.requestCount.toLocaleString()}</span>
                            <BarChart3 className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(key.status)}</TableCell>
                        <TableCell>
                          {key.lastUsedAt 
                            ? format(new Date(key.lastUsedAt), 'MMM d, yyyy HH:mm')
                            : <span className="text-muted-foreground">Never</span>
                          }
                        </TableCell>
                        <TableCell>
                          {key.expiresAt 
                            ? format(new Date(key.expiresAt), 'MMM d, yyyy')
                            : <span className="text-muted-foreground">No expiration</span>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedKey(key);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={key.status === 'revoked'}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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
        
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy Protections
              </CardTitle>
              <CardDescription>
                All research API responses are protected with the following safeguards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    PII Stripping
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    All personally identifiable information is removed before data is returned. 
                    Names, addresses, SSNs, and other sensitive fields are never exposed.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Minimum Sample Threshold (K=10)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Groups with fewer than 10 records are suppressed to prevent re-identification.
                    Small cell counts are rounded to the nearest 5.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Data Aggregation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    All data is aggregated at the program/state level. Individual case records 
                    are never returned, only statistical summaries.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Full Audit Logging
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Every API request is logged with timestamp, key ID, endpoint, and parameters.
                    Audit logs are retained for 7 years per IRS Pub 1075.
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Data Use Agreement Required</h3>
                <p className="text-sm text-blue-700">
                  All research partners must sign a Data Use Agreement (DUA) before receiving API keys.
                  DUAs specify permitted uses, publication requirements, and data destruction timelines.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the API key for "{selectedKey?.name}"? 
              This action cannot be undone and will immediately disable their API access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => selectedKey && revokeMutation.mutate(selectedKey.id)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

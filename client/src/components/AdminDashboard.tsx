import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Settings, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PolicySource {
  id: string;
  name: string;
  url?: string;
  benefitProgramId?: string;
  syncType: string;
  syncStatus: string;
  lastSyncAt?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const [newSourceDialogOpen, setNewSourceDialogOpen] = useState(false);
  const [newSourceData, setNewSourceData] = useState({
    name: "",
    url: "",
    benefitProgramId: "",
    syncType: "manual",
    syncConfig: "",
  });
  const { toast } = useToast();

  const { data: policySources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["/api/policy-sources"],
  });

  const { data: benefitPrograms = [] } = useQuery({
    queryKey: ["/api/benefit-programs"],
  });

  const { data: systemStatus } = useQuery({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const createSourceMutation = useMutation({
    mutationFn: async (sourceData: any) => {
      const response = await apiRequest("POST", "/api/policy-sources", sourceData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      toast({
        title: "Policy Source Added",
        description: "New policy source has been created successfully.",
      });
      setNewSourceDialogOpen(false);
      setNewSourceData({
        name: "",
        url: "",
        benefitProgramId: "",
        syncType: "manual",
        syncConfig: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create policy source.",
        variant: "destructive",
      });
      console.error("Error creating policy source:", error);
    },
  });

  const updateSyncStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/policy-sources/${id}`, {
        syncStatus: status,
        lastSyncAt: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
    },
  });

  const handleCreateSource = () => {
    if (!newSourceData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Source name is required.",
        variant: "destructive",
      });
      return;
    }

    const sourceData = {
      ...newSourceData,
      syncConfig: newSourceData.syncConfig ? JSON.parse(newSourceData.syncConfig) : null,
    };

    createSourceMutation.mutate(sourceData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "syncing":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "idle":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "syncing":
        return "bg-yellow-100 text-yellow-800";
      case "idle":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const mockRecentActivity = [
    { user: "Admin User", action: "updated SNAP income limits", time: "2 hours ago" },
    { user: "System", action: "processed 47 new documents", time: "4 hours ago" },
    { user: "API Sync", action: "updated federal regulations", time: "6 hours ago" },
    { user: "User Query", action: "1,247 searches processed", time: "12 hours ago" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-foreground">Administration Dashboard</h3>
          <p className="text-muted-foreground">Manage policy sources and monitor system health</p>
        </div>
        <Dialog open={newSourceDialogOpen} onOpenChange={setNewSourceDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-policy-source">
              <Plus className="mr-2 h-4 w-4" />
              Add Policy Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Add New Policy Source</DialogTitle>
              <DialogDescription>
                Create a new policy source for automatic document synchronization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="source-name">Source Name *</Label>
                <Input
                  id="source-name"
                  value={newSourceData.name}
                  onChange={(e) => setNewSourceData({ ...newSourceData, name: e.target.value })}
                  placeholder="e.g., Federal SNAP Regulations"
                  data-testid="input-source-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-url">Source URL</Label>
                <Input
                  id="source-url"
                  value={newSourceData.url}
                  onChange={(e) => setNewSourceData({ ...newSourceData, url: e.target.value })}
                  placeholder="https://example.gov/regulations"
                  data-testid="input-source-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benefit-program">Benefit Program</Label>
                <Select 
                  value={newSourceData.benefitProgramId} 
                  onValueChange={(value) => setNewSourceData({ ...newSourceData, benefitProgramId: value })}
                >
                  <SelectTrigger data-testid="select-benefit-program">
                    <SelectValue placeholder="Select benefit program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Programs</SelectItem>
                    {benefitPrograms.map((program: any) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-type">Sync Type</Label>
                <Select 
                  value={newSourceData.syncType} 
                  onValueChange={(value) => setNewSourceData({ ...newSourceData, syncType: value })}
                >
                  <SelectTrigger data-testid="select-sync-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="web_scraping">Web Scraping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-config">Sync Configuration (JSON)</Label>
                <Textarea
                  id="sync-config"
                  value={newSourceData.syncConfig}
                  onChange={(e) => setNewSourceData({ ...newSourceData, syncConfig: e.target.value })}
                  placeholder='{"frequency": "daily", "auth": {"type": "bearer"}}'
                  data-testid="textarea-sync-config"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setNewSourceDialogOpen(false)}
                data-testid="button-cancel-source"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSource}
                disabled={createSourceMutation.isPending}
                data-testid="button-create-source"
              >
                {createSourceMutation.isPending ? "Creating..." : "Create Source"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policy Source Management */}
        <Card className="shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Policy Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : policySources.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No policy sources configured yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {policySources.map((source: PolicySource) => (
                  <div 
                    key={source.id} 
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    data-testid={`policy-source-${source.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(source.syncStatus)}
                      <div>
                        <div className="font-medium text-foreground">{source.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {source.syncType} • 
                          {source.lastSyncAt ? (
                            ` Last updated: ${new Date(source.lastSyncAt).toLocaleDateString()}`
                          ) : (
                            " Never synced"
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(source.syncStatus)}>
                        {source.syncStatus}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-settings-${source.id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Service Health */}
            <div className="space-y-3 mb-6">
              {systemStatus?.systemHealth ? (
                Object.entries(systemStatus.systemHealth).map(([service, status]) => (
                  <div 
                    key={service}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      status === "operational" 
                        ? "bg-green-50 border-green-200" 
                        : status === "degraded"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-red-50 border-red-200"
                    }`}
                    data-testid={`service-status-${service}`}
                  >
                    <div className="flex items-center space-x-3">
                      {status === "operational" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : status === "degraded" ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        status === "operational" ? "text-green-800" : 
                        status === "degraded" ? "text-yellow-800" : "text-red-800"
                      }`}>
                        {service.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                    </div>
                    <span className={`text-sm capitalize ${
                      status === "operational" ? "text-green-600" : 
                      status === "degraded" ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">Vector Database</span>
                    </div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">OCR Pipeline</span>
                    </div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">AI Model API</span>
                    </div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div>
              <h5 className="font-medium text-foreground mb-3">Recent Activity</h5>
              <div className="space-y-2">
                {mockRecentActivity.map((activity, index) => (
                  <div 
                    key={index} 
                    className="text-sm text-muted-foreground"
                    data-testid={`activity-${index}`}
                  >
                    <span className="text-foreground font-medium">{activity.user}</span> {activity.action} • {activity.time}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

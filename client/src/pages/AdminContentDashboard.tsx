import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SyncJobReviewTable } from "@/components/admin/SyncJobReviewTable";
import { SyncJobPreviewDialog } from "@/components/admin/SyncJobPreviewDialog";
import { TemplateCard } from "@/components/admin/TemplateCard";
import { ContentAnalyticsDashboard } from "@/components/admin/ContentAnalyticsDashboard";
import type { ContentSyncJob, DynamicNotificationTemplate, GeneratedNotification } from "@shared/schema";

export default function AdminContentDashboard() {
  const [, navigate] = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sync-jobs");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("all");
  const [jobProgramFilter, setJobProgramFilter] = useState<string>("all");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<ContentSyncJob | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Sync Jobs Query with auto-refetch
  const { data: syncJobs = [], isLoading: jobsLoading } = useQuery<ContentSyncJob[]>({
    queryKey: ['/api/content-sync/jobs', jobStatusFilter, jobProgramFilter],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Templates Query
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DynamicNotificationTemplate[]>({
    queryKey: ['/api/notifications/templates'],
  });

  // Analytics Query
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/content-analytics'],
  });

  // Settings Query
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/content-sync/settings'],
  });

  // Template Usage Query
  const { data: templateUsage = [], isLoading: usageLoading } = useQuery<GeneratedNotification[]>({
    queryKey: ['/api/notifications/templates', selectedTemplateId, 'usage'],
    enabled: !!selectedTemplateId && usageDialogOpen,
  });

  // Settings Mutation
  const [settingsForm, setSettingsForm] = useState({
    defaultAutoRegenerate: false,
    syncDetectionCron: '0 * * * *',
    requiredReviewerRoles: ['admin'] as string[],
    notificationChannels: ['in_app'] as string[],
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: typeof settingsForm) => {
      return await apiRequest('/api/content-sync/settings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-sync/settings'] });
      toast({
        title: "Settings Saved",
        description: "Content sync settings have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Update settings form when data loads
  useState(() => {
    if (settings) {
      setSettingsForm({
        defaultAutoRegenerate: settings.defaultAutoRegenerate ?? false,
        syncDetectionCron: settings.syncDetectionCron ?? '0 * * * *',
        requiredReviewerRoles: settings.requiredReviewerRoles ?? ['admin'],
        notificationChannels: settings.notificationChannels ?? ['in_app'],
      });
    }
  });

  // Filter sync jobs
  const filteredJobs = syncJobs.filter((job) => {
    if (jobStatusFilter !== 'all' && job.status !== jobStatusFilter) return false;
    return true;
  });

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const searchLower = templateSearch.toLowerCase();
    return (
      template.templateName.toLowerCase().includes(searchLower) ||
      template.templateCode.toLowerCase().includes(searchLower)
    );
  });

  // Get templates with usage count
  const templatesWithUsage = filteredTemplates.map((template) => {
    const usageCount = analytics?.templateMetrics?.topTemplates?.find(
      (t: any) => t.id === template.id
    )?.usageCount || 0;
    return { ...template, usageCount };
  });

  // Count pending jobs
  const pendingCount = syncJobs.filter((j) => j.status === 'pending').length;

  const handlePreviewJob = (job: ContentSyncJob) => {
    setSelectedJob(job);
    setPreviewDialogOpen(true);
  };

  const handleViewUsage = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setUsageDialogOpen(true);
  };

  const handleTriggerSync = async () => {
    try {
      await apiRequest('/api/content-sync/trigger', { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['/api/content-sync/jobs'] });
      toast({
        title: "Sync Triggered",
        description: "RaC change detection has been triggered",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger sync",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Content Dashboard - Maryland Benefits Platform</title>
      </Helmet>

      <div className="container mx-auto py-8 px-4" data-testid="admin-content-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="dashboard-title">
              Content Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage dynamic content, review sync jobs, and monitor template performance
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleTriggerSync}
            data-testid="button-trigger-sync"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Trigger Sync
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="dashboard-tabs">
            <TabsTrigger value="sync-jobs" className="relative" data-testid="tab-sync-jobs">
              Sync Jobs
              {pendingCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  data-testid="pending-jobs-badge"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          {/* Tab 1: Sync Jobs Review */}
          <TabsContent value="sync-jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync Job Review Queue</CardTitle>
                <CardDescription>
                  Review and approve content changes triggered by Rules as Code updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                      <SelectTrigger id="status-filter" data-testid="select-status-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="program-filter">Program</Label>
                    <Select value={jobProgramFilter} onValueChange={setJobProgramFilter}>
                      <SelectTrigger id="program-filter" data-testid="select-program-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        <SelectItem value="SNAP">SNAP</SelectItem>
                        <SelectItem value="Medicaid">Medicaid</SelectItem>
                        <SelectItem value="TANF">TANF</SelectItem>
                        <SelectItem value="OHEP">OHEP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Jobs Table */}
                {jobsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <SyncJobReviewTable
                    jobs={filteredJobs}
                    onPreview={handlePreviewJob}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Template Management */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Notification Templates</CardTitle>
                    <CardDescription>
                      Manage and edit dynamic notification templates
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => navigate('/admin/form-builder')}
                    data-testid="button-create-template"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates by name or code..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-template-search"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : templatesWithUsage.length === 0 ? (
                  <div className="text-center py-12" data-testid="templates-empty">
                    <p className="text-muted-foreground">
                      {templateSearch ? 'No templates match your search' : 'No templates found'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templatesWithUsage.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onViewUsage={handleViewUsage}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Analytics */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Content Analytics</CardTitle>
                <CardDescription>
                  Monitor sync job performance, template usage, and content quality
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : analytics ? (
                  <ContentAnalyticsDashboard data={analytics} />
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    No analytics data available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Settings */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Content Sync Settings</CardTitle>
                <CardDescription>
                  Configure content synchronization behavior and review policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Auto-Regenerate Toggle */}
                    <div className="flex items-center justify-between space-x-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-regenerate">Default Auto-Regenerate</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically regenerate content when RaC changes are detected
                        </p>
                      </div>
                      <Switch
                        id="auto-regenerate"
                        checked={settingsForm.defaultAutoRegenerate}
                        onCheckedChange={(checked) =>
                          setSettingsForm({ ...settingsForm, defaultAutoRegenerate: checked })
                        }
                        data-testid="switch-auto-regenerate"
                      />
                    </div>

                    {/* Sync Frequency */}
                    <div className="space-y-2">
                      <Label htmlFor="sync-frequency">Sync Detection Frequency</Label>
                      <Select
                        value={settingsForm.syncDetectionCron}
                        onValueChange={(value) =>
                          setSettingsForm({ ...settingsForm, syncDetectionCron: value })
                        }
                      >
                        <SelectTrigger id="sync-frequency" data-testid="select-sync-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0 * * * *">Hourly</SelectItem>
                          <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                          <SelectItem value="0 0 * * *">Daily</SelectItem>
                          <SelectItem value="0 0 * * 0">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        How often to check for Rules as Code changes
                      </p>
                    </div>

                    {/* Notification Channels */}
                    <div className="space-y-3">
                      <Label>Notification Channels for Sync Alerts</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="channel-email"
                            checked={settingsForm.notificationChannels.includes('email')}
                            onChange={(e) => {
                              const channels = e.target.checked
                                ? [...settingsForm.notificationChannels, 'email']
                                : settingsForm.notificationChannels.filter((c) => c !== 'email');
                              setSettingsForm({ ...settingsForm, notificationChannels: channels });
                            }}
                            data-testid="checkbox-channel-email"
                            className="rounded"
                          />
                          <Label htmlFor="channel-email" className="font-normal cursor-pointer">
                            Email
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="channel-sms"
                            checked={settingsForm.notificationChannels.includes('sms')}
                            onChange={(e) => {
                              const channels = e.target.checked
                                ? [...settingsForm.notificationChannels, 'sms']
                                : settingsForm.notificationChannels.filter((c) => c !== 'sms');
                              setSettingsForm({ ...settingsForm, notificationChannels: channels });
                            }}
                            data-testid="checkbox-channel-sms"
                            className="rounded"
                          />
                          <Label htmlFor="channel-sms" className="font-normal cursor-pointer">
                            SMS
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="channel-in-app"
                            checked={settingsForm.notificationChannels.includes('in_app')}
                            onChange={(e) => {
                              const channels = e.target.checked
                                ? [...settingsForm.notificationChannels, 'in_app']
                                : settingsForm.notificationChannels.filter((c) => c !== 'in_app');
                              setSettingsForm({ ...settingsForm, notificationChannels: channels });
                            }}
                            data-testid="checkbox-channel-in-app"
                            className="rounded"
                          />
                          <Label htmlFor="channel-in-app" className="font-normal cursor-pointer">
                            In-App
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <Button
                      onClick={() => saveSettingsMutation.mutate(settingsForm)}
                      disabled={saveSettingsMutation.isPending}
                      className="w-full"
                      data-testid="button-save-settings"
                    >
                      <SettingsIcon className="h-4 w-4 mr-2" />
                      {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <SyncJobPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        job={selectedJob}
      />

      {/* Template Usage Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="usage-dialog">
          <DialogHeader>
            <DialogTitle>Template Usage History</DialogTitle>
            <DialogDescription>
              Recent notifications generated using this template (max 100)
            </DialogDescription>
          </DialogHeader>

          {usageLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : templateUsage.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No usage history found for this template
            </p>
          ) : (
            <div className="space-y-2">
              {templateUsage.map((usage) => (
                <Card key={usage.id}>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Recipient</p>
                        <p className="font-medium">
                          {usage.recipient?.fullName || usage.recipient?.username || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Generated At</p>
                        <p className="font-medium">
                          {new Date(usage.generatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Delivery Status</p>
                        <Badge variant={usage.deliveryStatus === 'delivered' ? 'default' : 'secondary'}>
                          {usage.deliveryStatus}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Channel</p>
                        <p className="font-medium capitalize">{usage.deliveryChannel}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

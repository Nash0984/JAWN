import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, Play, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronRight, 
  Code2, Download, Globe2, Zap, Server, ExternalLink, TrendingUp, AlertTriangle
} from "lucide-react";
import { PolicySource } from "@shared/schema";

interface BenefitProgram {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

const PROGRAM_ICONS: Record<string, any> = {
  SNAP: "🍎",
  MEDICAID: "🏥",
  TCA: "💵",
  TANF: "💵",
  OHEP: "⚡",
  TAX_CREDITS: "🏠",
  VITA: "📋",
};

const SYNC_METHOD_ICONS: Record<string, any> = {
  web_scraping: <Globe2 className="h-4 w-4" />,
  bulk_download: <Download className="h-4 w-4" />,
  direct_download: <Download className="h-4 w-4" />,
  api: <Server className="h-4 w-4" />,
  manual: <Clock className="h-4 w-4" />,
};

const SYNC_METHOD_LABELS: Record<string, string> = {
  web_scraping: "Web Scraping",
  bulk_download: "Bulk Download",
  direct_download: "Direct Download",
  api: "API",
  manual: "Manual",
};

export default function PolicySources() {
  const { toast } = useToast();
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [customSchedules, setCustomSchedules] = useState<Record<string, string>>({});

  const { data: sources, isLoading: sourcesLoading } = useQuery<PolicySource[]>({
    queryKey: ["/api/policy-sources"],
  });

  const { data: programs } = useQuery<BenefitProgram[]>({
    queryKey: ["/api/public/benefit-programs"],
  });

  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest("PATCH", `/api/policy-sources/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      toast({
        title: "Source updated",
        description: "Policy source has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update policy source.",
        variant: "destructive",
      });
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/policy-sources/${id}/sync`, {});
    },
    onSuccess: (data, sourceId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      toast({
        title: "Sync completed",
        description: "Policy source has been synced successfully.",
      });
      setTriggeringSource(null);
    },
    onError: (error, sourceId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      toast({
        title: "Sync failed",
        description: "Failed to sync policy source. Check the error details.",
        variant: "destructive",
      });
      setTriggeringSource(null);
    },
  });

  const triggerManualPullMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest("POST", "/api/automated-ingestion/trigger", { reason });
    },
    onSuccess: () => {
      toast({
        title: "Pull triggered",
        description: "Manual policy document pull has been initiated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      setTriggeringSource(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to trigger manual pull.",
        variant: "destructive",
      });
      setTriggeringSource(null);
    },
  });

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "syncing":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRacStatusBadge = (racStatus: string | null) => {
    switch (racStatus) {
      case "production_ready":
        return (
          <Badge variant="default" className="bg-green-600" data-testid="badge-rac-production">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Production Ready
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-yellow-600" data-testid="badge-rac-progress">
            <RefreshCw className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "planned":
        return (
          <Badge variant="outline" data-testid="badge-rac-planned">
            <Clock className="h-3 w-3 mr-1" />
            Planned
          </Badge>
        );
      case "auto_update":
        return (
          <Badge variant="secondary" data-testid="badge-rac-auto">
            <Zap className="h-3 w-3 mr-1" />
            Auto-update
          </Badge>
        );
      default:
        return null;
    }
  };

  const getRacTooltip = (racStatus: string | null) => {
    switch (racStatus) {
      case "production_ready":
        return "Fully converted to executable Rules as Code with comprehensive test coverage";
      case "in_progress":
        return "Partial implementation or external API integration (e.g., PolicyEngine)";
      case "planned":
        return "Scheduled for future conversion to Rules as Code";
      case "auto_update":
        return "Automatically feeds into existing Rules as Code systems when synced";
      default:
        return "Rules as Code status not yet determined";
    }
  };

  const getScheduleOptions = (maxFrequency: string | null) => {
    const allOptions = [
      { value: "off", label: "Off" },
      { value: "weekly", label: "Weekly" },
      { value: "bi-weekly", label: "Bi-Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "custom", label: "Custom (Cron)" },
    ];

    if (!maxFrequency) return allOptions;

    const frequencyOrder = ["weekly", "bi-weekly", "monthly"];
    const maxIndex = frequencyOrder.indexOf(maxFrequency);

    return allOptions.filter(
      (opt) => opt.value === "off" || opt.value === "custom" || frequencyOrder.indexOf(opt.value) >= maxIndex
    );
  };

  const handleScheduleChange = (sourceId: string, schedule: string) => {
    if (schedule === "custom") {
      // Show custom input, don't update yet
      return;
    }
    updateSourceMutation.mutate({ id: sourceId, updates: { syncSchedule: schedule } });
  };

  const handleCustomScheduleSubmit = (sourceId: string) => {
    const cronExpression = customSchedules[sourceId];
    if (cronExpression) {
      updateSourceMutation.mutate({
        id: sourceId,
        updates: { syncSchedule: "custom", syncConfig: { cron: cronExpression } },
      });
    }
  };

  const handleSyncSource = (sourceId: string) => {
    setTriggeringSource(sourceId);
    syncSourceMutation.mutate(sourceId);
  };

  const handleManualPull = () => {
    setTriggeringSource("all");
    triggerManualPullMutation.mutate("Manual pull from admin UI");
  };

  const toggleProgram = (programId: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  if (sourcesLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Group sources by program
  const sourcesByProgram = sources?.reduce((acc, source) => {
    const programId = source.benefitProgramId || "unassigned";
    if (!acc[programId]) acc[programId] = [];
    acc[programId].push(source);
    return acc;
  }, {} as Record<string, PolicySource[]>) || {};

  // Get program info
  const getProgramInfo = (programId: string) => {
    if (programId === "unassigned") {
      return { id: "unassigned", name: "Unassigned Sources", code: "OTHER", description: null };
    }
    return programs?.find((p) => p.id === programId);
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="title-sources">
            Policy Sources Management
          </h1>
          <p className="text-muted-foreground">
            Control automated document ingestion from policy sources across all benefit programs
          </p>
        </div>

        {/* Manual Pull Control */}
        <Card className="mb-6" data-testid="card-manual-pull">
          <CardHeader>
            <CardTitle>Manual Document Pull</CardTitle>
            <CardDescription>
              Trigger an immediate pull from all active policy sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleManualPull}
              disabled={triggerManualPullMutation.isPending}
              data-testid="button-manual-pull"
            >
              {triggerManualPullMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Pulling Documents...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Trigger Manual Pull
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Program-Based Organization */}
        <div className="space-y-6">
          {Object.entries(sourcesByProgram)
            .sort(([a], [b]) => {
              // Sort by program order: SNAP, Medicaid, TCA/TANF, OHEP, Tax Credits, VITA, Other
              const order = ["SNAP", "MEDICAID", "TCA", "TANF", "OHEP", "TAX_CREDITS", "VITA"];
              const aInfo = getProgramInfo(a);
              const bInfo = getProgramInfo(b);
              const aIndex = order.indexOf(aInfo?.code || "");
              const bIndex = order.indexOf(bInfo?.code || "");
              if (aIndex === -1 && bIndex === -1) return 0;
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            })
            .map(([programId, programSources]) => {
              const programInfo = getProgramInfo(programId);
              const isExpanded = expandedPrograms.has(programId);

              return (
                <Collapsible
                  key={programId}
                  open={isExpanded}
                  onOpenChange={() => toggleProgram(programId)}
                  data-testid={`collapsible-program-${programId}`}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full" data-testid={`trigger-program-${programId}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <span className="text-2xl">{PROGRAM_ICONS[programInfo?.code || "OTHER"] || "📁"}</span>
                            <div className="text-left">
                              <CardTitle>{programInfo?.name || "Unknown Program"}</CardTitle>
                              <CardDescription>{programInfo?.description || ""}</CardDescription>
                            </div>
                          </div>
                          <Badge variant="outline" data-testid={`badge-count-${programId}`}>
                            {programSources.length} {programSources.length === 1 ? "source" : "sources"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {programSources.map((source) => {
                          const scheduleOptions = getScheduleOptions(source.maxAllowedFrequency);
                          const isCustomSchedule = source.syncSchedule === "custom";

                          return (
                            <Card key={source.id} data-testid={`source-card-${source.id}`} className="border-l-4" style={{ borderLeftColor: source.isActive ? "#10b981" : "#94a3b8" }}>
                              <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <CardTitle className="text-lg">{source.name}</CardTitle>
                                      <Badge variant="secondary" className="text-xs" data-testid={`badge-type-${source.id}`}>
                                        {source.sourceType.replace(/_/g, " ")}
                                      </Badge>
                                      {source.priority && source.priority > 0 && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="outline" className="text-xs" data-testid={`badge-priority-${source.id}`}>
                                              <TrendingUp className="h-3 w-3 mr-1" />
                                              Priority {source.priority}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>Higher priority sources are synced first</TooltipContent>
                                        </Tooltip>
                                      )}
                                      {source.hasNewData && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="default" className="bg-blue-600 text-xs" data-testid={`badge-new-data-${source.id}`}>
                                              <AlertTriangle className="h-3 w-3 mr-1" />
                                              New Data
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>New data detected in last sync</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <CardDescription>{source.description}</CardDescription>

                                    {/* Rules as Code Status */}
                                    {source.racStatus && (
                                      <div className="flex items-center gap-2">
                                        <Tooltip>
                                          <TooltipTrigger>
                                            {getRacStatusBadge(source.racStatus)}
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            {getRacTooltip(source.racStatus)}
                                          </TooltipContent>
                                        </Tooltip>
                                        {source.racCodeLocation && (
                                          <a
                                            href={`https://github.com/yourusername/yourrepo/blob/main/${source.racCodeLocation}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                            data-testid={`link-rac-code-${source.id}`}
                                          >
                                            <Code2 className="h-3 w-3" />
                                            View Code
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <Switch
                                    checked={source.isActive}
                                    onCheckedChange={(checked) =>
                                      updateSourceMutation.mutate({ id: source.id, updates: { isActive: checked } })
                                    }
                                    data-testid={`switch-active-${source.id}`}
                                  />
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                  {/* Sync Method */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">Sync Method</p>
                                    <div className="flex items-center gap-2" data-testid={`text-sync-method-${source.id}`}>
                                      {SYNC_METHOD_ICONS[source.syncType]}
                                      <span className="font-medium text-sm">
                                        {SYNC_METHOD_LABELS[source.syncType] || source.syncType}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Schedule Control */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">
                                      Sync Schedule
                                      {source.maxAllowedFrequency && (
                                        <span className="text-xs text-orange-600 ml-1">
                                          (Max: {source.maxAllowedFrequency})
                                        </span>
                                      )}
                                    </p>
                                    <Select
                                      value={source.syncSchedule || "off"}
                                      onValueChange={(value) => handleScheduleChange(source.id, value)}
                                      data-testid={`select-schedule-${source.id}`}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {scheduleOptions.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {isCustomSchedule && (
                                      <div className="flex gap-2 mt-2">
                                        <Input
                                          placeholder="0 0 * * 0 (cron)"
                                          value={customSchedules[source.id] || ""}
                                          onChange={(e) =>
                                            setCustomSchedules({ ...customSchedules, [source.id]: e.target.value })
                                          }
                                          className="h-8 text-xs"
                                          data-testid={`input-custom-cron-${source.id}`}
                                        />
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => handleCustomScheduleSubmit(source.id)}
                                          data-testid={`button-save-cron-${source.id}`}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Status */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">Status</p>
                                    <div className="flex items-center gap-2">
                                      {getSyncStatusIcon(source.syncStatus || "idle")}
                                      <span className="capitalize text-sm" data-testid={`text-status-${source.id}`}>
                                        {source.syncStatus || "idle"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Last Sync */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">Last Sync</p>
                                    <p className="font-medium text-xs" data-testid={`text-last-sync-${source.id}`}>
                                      {formatDate(source.lastSyncAt as string | null)}
                                    </p>
                                  </div>

                                  {/* Documents */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">Documents</p>
                                    <p className="font-medium text-sm" data-testid={`text-doc-count-${source.id}`}>
                                      {source.documentCount || 0}
                                    </p>
                                  </div>

                                  {/* Sync Now Button */}
                                  <div>
                                    <p className="text-muted-foreground text-xs mb-1">Actions</p>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSyncSource(source.id)}
                                      disabled={triggeringSource === source.id || syncSourceMutation.isPending}
                                      data-testid={`button-sync-${source.id}`}
                                      className="h-8 text-xs"
                                    >
                                      {triggeringSource === source.id ? (
                                        <>
                                          <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                          Syncing...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="mr-1 h-3 w-3" />
                                          Sync Now
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>

                                {/* Source URL */}
                                {source.url && (
                                  <div className="pt-3 border-t">
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      data-testid={`link-url-${source.id}`}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {source.url}
                                    </a>
                                  </div>
                                )}

                                {/* Sync Error */}
                                {source.syncError && (
                                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-xs text-red-800" data-testid={`text-error-${source.id}`}>
                                      <AlertCircle className="h-3 w-3 inline mr-1" />
                                      {source.syncError}
                                    </p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
        </div>
      </div>
    </TooltipProvider>
  );
}

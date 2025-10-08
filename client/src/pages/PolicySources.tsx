import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RefreshCw, Play, AlertCircle, CheckCircle2, Clock, Globe, Shield } from "lucide-react";
import { PolicySource } from "@shared/schema";

export default function PolicySources() {
  const { toast } = useToast();
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null);

  const { data: sources, isLoading } = useQuery<PolicySource[]>({
    queryKey: ["/api/policy-sources"],
  });

  const { data: schedulesData } = useQuery<{ schedules: any[] }>({
    queryKey: ["/api/automated-ingestion/schedules"],
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/policy-sources/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policy-sources"] });
      toast({
        title: "Source updated",
        description: "Policy source status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update policy source status.",
        variant: "destructive",
      });
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

  const getJurisdictionIcon = (jurisdiction: string) => {
    return jurisdiction === "federal" ? (
      <Shield className="h-4 w-4 text-blue-600" />
    ) : (
      <Globe className="h-4 w-4 text-[var(--maryland-red)]" />
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  const handleManualPull = () => {
    setTriggeringSource("all");
    triggerManualPullMutation.mutate("Manual pull from admin UI");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const federalSources = sources?.filter((s) => s.jurisdiction === "federal") || [];
  const marylandSources = sources?.filter((s) => s.jurisdiction === "maryland") || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="title-sources">
          Policy Sources Management
        </h1>
        <p className="text-muted-foreground">
          Control automated document ingestion from federal and Maryland SNAP policy sources
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

      {/* Federal Sources */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Federal Sources</h2>
          <Badge variant="outline">{federalSources.length}</Badge>
        </div>
        <div className="space-y-4">
          {federalSources.map((source) => (
            <Card key={source.id} data-testid={`source-card-${source.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getJurisdictionIcon(source.jurisdiction)}
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {source.sourceType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardDescription>{source.description}</CardDescription>
                  </div>
                  <Switch
                    checked={source.isActive}
                    onCheckedChange={(checked) =>
                      toggleSourceMutation.mutate({ id: source.id, isActive: checked })
                    }
                    data-testid={`switch-active-${source.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Sync Schedule</p>
                    <p className="font-medium capitalize" data-testid={`text-schedule-${source.id}`}>
                      {source.syncSchedule || "Manual"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {getSyncStatusIcon(source.syncStatus || "idle")}
                      <span className="capitalize" data-testid={`text-status-${source.id}`}>
                        {source.syncStatus || "idle"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Sync</p>
                    <p className="font-medium text-xs" data-testid={`text-last-sync-${source.id}`}>
                      {formatDate(source.lastSyncAt as string | null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Documents</p>
                    <p className="font-medium" data-testid={`text-doc-count-${source.id}`}>
                      {source.documentCount || 0}
                    </p>
                  </div>
                </div>
                {source.url && (
                  <div className="mt-3 pt-3 border-t">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                      data-testid={`link-url-${source.id}`}
                    >
                      {source.url}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Maryland Sources */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-[var(--maryland-red)]" />
          <h2 className="text-xl font-semibold">Maryland Sources</h2>
          <Badge variant="outline">{marylandSources.length}</Badge>
        </div>
        <div className="space-y-4">
          {marylandSources.map((source) => (
            <Card key={source.id} data-testid={`source-card-${source.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getJurisdictionIcon(source.jurisdiction)}
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {source.sourceType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardDescription>{source.description}</CardDescription>
                  </div>
                  <Switch
                    checked={source.isActive}
                    onCheckedChange={(checked) =>
                      toggleSourceMutation.mutate({ id: source.id, isActive: checked })
                    }
                    data-testid={`switch-active-${source.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Sync Schedule</p>
                    <p className="font-medium capitalize" data-testid={`text-schedule-${source.id}`}>
                      {source.syncSchedule || "Manual"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {getSyncStatusIcon(source.syncStatus || "idle")}
                      <span className="capitalize" data-testid={`text-status-${source.id}`}>
                        {source.syncStatus || "idle"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Last Sync</p>
                    <p className="font-medium text-xs" data-testid={`text-last-sync-${source.id}`}>
                      {formatDate(source.lastSyncAt as string | null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Documents</p>
                    <p className="font-medium" data-testid={`text-doc-count-${source.id}`}>
                      {source.documentCount || 0}
                    </p>
                  </div>
                </div>
                {source.url && (
                  <div className="mt-3 pt-3 border-t">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                      data-testid={`link-url-${source.id}`}
                    >
                      {source.url}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { 
  RefreshCw, 
  Clock, 
  CheckCircle2,
  Pause,
  Play,
  FileText,
  Database,
  Globe,
  Upload,
  Settings
} from "lucide-react";

type ScheduleStatus = {
  name: string;
  description: string;
  enabled: boolean;
  interval: string;
  nextRun?: string;
};

type SchedulerStatus = {
  schedules: ScheduleStatus[];
  activeCount: number;
  pausedCount: number;
};

export default function SmartScheduler() {
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [frequencyDialogOpen, setFrequencyDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [newFrequency, setNewFrequency] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadVersion, setUploadVersion] = useState<string>('');
  const [uploadNotes, setUploadNotes] = useState<string>('');

  // Fetch scheduler status
  const { data: status, isLoading } = useQuery<SchedulerStatus>({
    queryKey: ['/api/scheduler/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Trigger mutation for manual sync
  const triggerMutation = useMutation({
    mutationFn: async (source: string) => {
      return await apiRequest('POST', `/api/scheduler/trigger/${source}`);
    },
    onSuccess: (_data, source) => {
      toast({
        title: "Success",
        description: `${getSourceLabel(source)} sync triggered successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
    },
    onError: (error: any, source) => {
      toast({
        title: "Trigger Failed",
        description: error.message || `Failed to trigger ${getSourceLabel(source)} sync`,
        variant: "destructive",
      });
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ source, enabled }: { source: string; enabled: boolean }) => {
      return await apiRequest('PATCH', `/api/scheduler/toggle/${source}`, { enabled });
    },
    onSuccess: (_data, { source, enabled }) => {
      toast({
        title: "Success",
        description: `${getSourceLabel(source)} ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Toggle Failed",
        description: error.message || 'Failed to toggle schedule',
        variant: "destructive",
      });
    },
  });

  // Frequency mutation
  const frequencyMutation = useMutation({
    mutationFn: async ({ source, cronExpression }: { source: string; cronExpression: string }) => {
      return await apiRequest('PATCH', `/api/scheduler/frequency/${source}`, { cronExpression });
    },
    onSuccess: (_data, { source }) => {
      toast({
        title: "Success",
        description: `${getSourceLabel(source)} frequency updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
      setFrequencyDialogOpen(false);
      setNewFrequency('');
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to update frequency',
        variant: "destructive",
      });
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ source, file, version, notes }: { source: string; file: File; version: string; notes: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('version', version);
      formData.append('verificationNotes', notes);
      
      return await fetch(`/api/scheduler/upload/${source}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      }).then(res => res.json());
    },
    onSuccess: (_data, { source }) => {
      toast({
        title: "Success",
        description: `Verified ${getSourceLabel(source)} document uploaded successfully`,
      });
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadVersion('');
      setUploadNotes('');
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || 'Failed to upload document',
        variant: "destructive",
      });
    },
  });

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'ecfr': 'eCFR Title 7 SNAP Regulations',
      'irs_publications': 'IRS VITA Publications',
      'federal_bills': 'Federal Bill Status',
      'public_laws': 'Federal Public Laws',
      'maryland_legislature': `${stateName} Legislature Bills`,
      'fns_state_options': 'FNS SNAP State Options'
    };
    return labels[source] || source;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ecfr':
      case 'federal_bills':
      case 'public_laws':
        return Database;
      case 'irs_publications':
        return FileText;
      case 'maryland_legislature':
        return Globe;
      case 'fns_state_options':
        return FileText;
      default:
        return Clock;
    }
  };

  const getIntervalLabel = (cronExpression: string) => {
    if (cronExpression === '0 0 * * *') return 'Daily';
    if (cronExpression === '0 0 * * 0') return 'Weekly';
    if (cronExpression === '0 0 1 * *') return 'Monthly';
    return cronExpression;
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6" data-testid="page-smart-scheduler">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Smart Scheduler</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Intelligent scheduling of automated policy document ingestion with source-specific optimization
        </p>
      </div>

      {/* Overview Stats */}
      {status && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-sources">
                {status.schedules.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-count">
                {status.activeCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paused Schedules</CardTitle>
              <Pause className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground" data-testid="text-paused-count">
                {status.pausedCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedules List */}
      {isLoading ? (
        <div className="text-center py-12" data-testid="loading-schedules">
          Loading scheduler status...
        </div>
      ) : !status ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No scheduler data available
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Source Schedules</CardTitle>
              <CardDescription>
                Automated ingestion schedules optimized for each source's realistic update frequency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.schedules.map((schedule) => {
                const Icon = getSourceIcon(schedule.name);
                return (
                  <div
                    key={schedule.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`card-schedule-${schedule.name}`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${schedule.enabled ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-900/20'}`}>
                        <Icon className={`h-5 w-5 ${schedule.enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold" data-testid={`text-source-name-${schedule.name}`}>
                            {getSourceLabel(schedule.name)}
                          </h3>
                          <Badge variant={schedule.enabled ? "default" : "secondary"} data-testid={`badge-status-${schedule.name}`}>
                            {schedule.enabled ? <><Play className="h-3 w-3 mr-1" /> Active</> : <><Pause className="h-3 w-3 mr-1" /> Paused</>}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {getIntervalLabel(schedule.interval)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-description-${schedule.name}`}>
                          {schedule.description}
                        </p>
                        {schedule.nextRun && (
                          <p className="text-xs text-muted-foreground">
                            Status: {schedule.nextRun}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`toggle-${schedule.name}`} className="text-xs">
                          {schedule.enabled ? 'On' : 'Off'}
                        </Label>
                        <Switch
                          id={`toggle-${schedule.name}`}
                          checked={schedule.enabled}
                          onCheckedChange={(checked) => toggleMutation.mutate({ source: schedule.name, enabled: checked })}
                          disabled={toggleMutation.isPending}
                          data-testid={`switch-toggle-${schedule.name}`}
                        />
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSource(schedule.name);
                          setNewFrequency(schedule.interval);
                          setFrequencyDialogOpen(true);
                        }}
                        data-testid={`button-edit-frequency-${schedule.name}`}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Frequency
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSource(schedule.name);
                          setUploadDialogOpen(true);
                        }}
                        data-testid={`button-upload-${schedule.name}`}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => triggerMutation.mutate(schedule.name)}
                        disabled={triggerMutation.isPending || !schedule.enabled}
                        data-testid={`button-trigger-${schedule.name}`}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
                        Trigger
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="text-blue-600 dark:text-blue-400">Cost Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This smart scheduler reduces check frequency by 70-80% compared to fixed global intervals, 
                with zero functionality loss. Each source is checked based on its realistic update frequency:
              </p>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>eCFR SNAP regulations: Weekly (updates quarterly at best)</li>
                <li>IRS Publications: Weekly (updated annually Oct-Dec for tax season)</li>
                <li>Federal Bills: Daily during session, weekly during recess</li>
                <li>Public Laws: Weekly (few enacted per month)</li>
                <li>{stateName} Legislature: Daily during session, paused rest of year</li>
                <li>FNS State Options: Monthly check (published annually in August)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Frequency Editor Dialog */}
      <Dialog open={frequencyDialogOpen} onOpenChange={setFrequencyDialogOpen}>
        <DialogContent data-testid="dialog-frequency-editor">
          <DialogHeader>
            <DialogTitle>Edit Schedule Frequency</DialogTitle>
            <DialogDescription>
              Update the schedule frequency for {getSourceLabel(selectedSource)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="frequency-select">Frequency</Label>
              <Select value={newFrequency} onValueChange={setNewFrequency}>
                <SelectTrigger id="frequency-select" data-testid="select-frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 0 * * *">Daily</SelectItem>
                  <SelectItem value="0 0 * * 0">Weekly (Sunday)</SelectItem>
                  <SelectItem value="0 0 1 * *">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cron expression: {newFrequency}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFrequencyDialogOpen(false)}
              data-testid="button-cancel-frequency"
            >
              Cancel
            </Button>
            <Button
              onClick={() => frequencyMutation.mutate({ source: selectedSource, cronExpression: newFrequency })}
              disabled={frequencyMutation.isPending || !newFrequency}
              data-testid="button-save-frequency"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Verified Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent data-testid="dialog-upload-document">
          <DialogHeader>
            <DialogTitle>Upload Verified Document</DialogTitle>
            <DialogDescription>
              Upload a manually verified golden source document for {getSourceLabel(selectedSource)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="upload-file">Document File</Label>
              <Input
                id="upload-file"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                data-testid="input-upload-file"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-version">Version / Edition</Label>
              <Input
                id="upload-version"
                type="text"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="e.g., Edition 17, 2025 Tax Year, etc."
                data-testid="input-upload-version"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-notes">Verification Notes (Optional)</Label>
              <Textarea
                id="upload-notes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                placeholder="Add any notes about verification or source authority"
                data-testid="textarea-upload-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                setUploadFile(null);
                setUploadVersion('');
                setUploadNotes('');
              }}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (uploadFile && uploadVersion) {
                  uploadMutation.mutate({
                    source: selectedSource,
                    file: uploadFile,
                    version: uploadVersion,
                    notes: uploadNotes,
                  });
                }
              }}
              disabled={uploadMutation.isPending || !uploadFile || !uploadVersion}
              data-testid="button-save-upload"
            >
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

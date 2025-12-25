import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { Users, FileText, Download, Plus, Calendar, Clock, CheckCircle2, AlertCircle, FileDown, BarChart, UserCircle, ExternalLink } from "lucide-react";
import { PolicyChatWidget } from "@/components/PolicyChatWidget";
import { DataCompletenessChecker } from "@/components/DataCompletenessChecker";
import { DataQualityDashboard } from "@/components/DataQualityDashboard";
import { exportToJSON, exportToCSV, exportToPDF, exportClientIntakeSummary, exportEEDataFormat } from "@/lib/exportUtils";
import { format } from "date-fns";

interface ClientInteractionSession {
  id: string;
  clientCaseId?: string;
  navigatorId: string;
  sessionType: string;
  interactionDate: string;
  durationMinutes?: number;
  location?: string;
  topicsDiscussed?: string[];
  documentsReceived?: any[];
  documentsVerified?: any[];
  actionItems?: any[];
  notes?: string;
  outcomeStatus?: string;
  exportedToEE: boolean;
  exportedAt?: string;
  exportBatchId?: string;
  createdAt: string;
}

interface EEExportBatch {
  id: string;
  exportType: string;
  sessionCount: number;
  exportFormat: string;
  filePath?: string;
  fileSize?: number;
  exportedBy: string;
  exportedAt: string;
  uploadedToEE: boolean;
  uploadedAt?: string;
  uploadConfirmation?: string;
  notes?: string;
}

const sessionFormSchema = z.object({
  clientCaseId: z.string().optional(),
  sessionType: z.string().min(1, "Session type is required"),
  location: z.string().min(1, "Location is required"),
  durationMinutes: z.coerce.number().min(1).optional(),
  topicsDiscussed: z.string().optional(),
  notes: z.string().optional(),
  outcomeStatus: z.string().min(1, "Outcome status is required"),
  actionItems: z.string().optional()
});

type SessionFormData = z.infer<typeof sessionFormSchema>;

const exportFormSchema = z.object({
  exportType: z.string().min(1, "Export type is required"),
  exportFormat: z.string().min(1, "Export format is required"),
  notes: z.string().optional()
});

type ExportFormData = z.infer<typeof exportFormSchema>;

interface HouseholdProfile {
  id: string;
  name: string;
  profileMode: string;
  clientCaseId?: string;
  householdSize: number;
}

export default function NavigatorWorkspace() {
  const { toast } = useToast();
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // Fetch household profiles
  const { data: profiles = [] } = useQuery<HouseholdProfile[]>({
    queryKey: ['/api/household-profiles'],
    select: (data) => data.filter((p: any) => p.profileMode === 'combined' || p.profileMode === 'benefits_only')
  });

  // Fetch sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<ClientInteractionSession[]>({
    queryKey: ['/api/navigator/sessions']
  });

  // Fetch export batches
  const { data: exports = [], isLoading: exportsLoading } = useQuery<EEExportBatch[]>({
    queryKey: ['/api/navigator/exports']
  });

  // Session form
  const sessionForm = useForm<SessionFormData>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      sessionType: "screening",
      location: "office",
      outcomeStatus: "completed"
    }
  });

  // Export form
  const exportForm = useForm<ExportFormData>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      exportType: "manual",
      exportFormat: "csv"
    }
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const payload = {
        ...data,
        topicsDiscussed: data.topicsDiscussed ? data.topicsDiscussed.split(',').map(t => t.trim()) : [],
        actionItems: data.actionItems ? data.actionItems.split(',').map(a => ({ task: a.trim(), completed: false })) : []
      };
      const response = await fetch('/api/navigator/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to create session');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/sessions'] });
      toast({
        title: "Session created",
        description: "Client interaction session has been logged successfully"
      });
      setIsSessionDialogOpen(false);
      sessionForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Create export mutation
  const createExportMutation = useMutation({
    mutationFn: async (data: ExportFormData) => {
      const response = await fetch('/api/navigator/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create export');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/exports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/navigator/sessions'] });
      toast({
        title: "Export created",
        description: "E&E export batch has been generated successfully"
      });
      setIsExportDialogOpen(false);
      exportForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Download export mutation
  const downloadExportMutation = useMutation({
    mutationFn: async (exportBatch: EEExportBatch) => {
      const response = await fetch(`/api/navigator/exports/${exportBatch.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      return { blob: await response.blob(), exportBatch };
    },
    onSuccess: ({ blob, exportBatch }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = exportBatch.exportFormat || 'csv';
      a.download = `ee-export-${exportBatch.id}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Download started",
        description: "E&E export file is downloading"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getSessionTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      screening: "bg-blue-100 text-blue-800",
      application_assist: "bg-green-100 text-green-800",
      recert_assist: "bg-purple-100 text-purple-800",
      documentation: "bg-yellow-100 text-yellow-800",
      follow_up: "bg-gray-100 text-gray-800"
    };
    return <Badge className={colors[type] || ""}>{type.replace('_', ' ')}</Badge>;
  };

  const getOutcomeStatusBadge = (status?: string) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      needs_follow_up: "bg-yellow-100 text-yellow-800",
      referred: "bg-blue-100 text-blue-800",
      application_submitted: "bg-purple-100 text-purple-800"
    };
    return <Badge className={colors[status] || ""}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Benefits Navigator Workspace
        </h1>
        <p className="text-muted-foreground">
          Track client sessions, manage documentation, and export E&E data
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList data-testid="nav-workspace-tabs">
          <TabsTrigger value="sessions" data-testid="tab-sessions">
            <Users className="w-4 h-4 mr-2" />
            Client Sessions
          </TabsTrigger>
          <TabsTrigger value="exports" data-testid="tab-exports">
            <Download className="w-4 h-4 mr-2" />
            E&E Exports
          </TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">
            <BarChart className="w-4 h-4 mr-2" />
            Data Quality
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Client Interaction Sessions</CardTitle>
                  <CardDescription>
                    Log and track all client interactions for SNAP application assistance
                  </CardDescription>
                </div>
                <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-session">
                      <Plus className="w-4 h-4 mr-2" />
                      New Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Log Client Interaction Session</DialogTitle>
                      <DialogDescription>
                        Record details of your interaction with a client
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...sessionForm}>
                      <form onSubmit={sessionForm.handleSubmit((data) => createSessionMutation.mutate(data))} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-select">Household Profile (Optional)</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={selectedProfileId} 
                              onValueChange={(value) => {
                                setSelectedProfileId(value);
                                const profile = profiles.find(p => p.id === value);
                                if (profile?.clientCaseId) {
                                  sessionForm.setValue('clientCaseId', profile.clientCaseId);
                                }
                              }}
                            >
                              <SelectTrigger id="profile-select" data-testid="select-household-profile">
                                <SelectValue placeholder="Select a household profile" />
                              </SelectTrigger>
                              <SelectContent>
                                {profiles.map((profile) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.name} ({profile.householdSize} {profile.householdSize === 1 ? 'member' : 'members'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => window.open('/profiler', '_blank')}
                              data-testid="button-open-profiler"
                              title="Open Household Profiler"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Link this session to an existing household profile or create a new one
                          </p>
                        </div>
                        <FormField
                          control={sessionForm.control}
                          name="clientCaseId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Case ID (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter case ID if available" {...field} data-testid="input-client-case-id" />
                              </FormControl>
                              <FormDescription>
                                Auto-filled from selected profile or enter manually
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="sessionType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-session-type">
                                    <SelectValue placeholder="Select session type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="screening">Screening</SelectItem>
                                  <SelectItem value="application_assist">Application Assistance</SelectItem>
                                  <SelectItem value="recert_assist">Recertification Assistance</SelectItem>
                                  <SelectItem value="documentation">Documentation</SelectItem>
                                  <SelectItem value="follow_up">Follow-up</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-location">
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="office">Office</SelectItem>
                                  <SelectItem value="phone">Phone</SelectItem>
                                  <SelectItem value="field_visit">Field Visit</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="durationMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="30" 
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                  data-testid="input-duration"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="topicsDiscussed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Topics Discussed</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., income verification, work exemption, deductions (comma-separated)" {...field} data-testid="input-topics" />
                              </FormControl>
                              <FormDescription>
                                Enter topics separated by commas
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="outcomeStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Outcome Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-outcome">
                                    <SelectValue placeholder="Select outcome" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="needs_follow_up">Needs Follow-up</SelectItem>
                                  <SelectItem value="referred">Referred</SelectItem>
                                  <SelectItem value="application_submitted">Application Submitted</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="actionItems"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Action Items</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., collect pay stubs, schedule recertification (comma-separated)" {...field} data-testid="input-action-items" />
                              </FormControl>
                              <FormDescription>
                                Enter action items separated by commas
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={sessionForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Enter additional notes about this session" rows={4} {...field} data-testid="input-notes" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createSessionMutation.isPending} data-testid="button-submit-session">
                            {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No client sessions logged yet. Click "New Session" to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Exported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(session.interactionDate), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>{getSessionTypeBadge(session.sessionType)}</TableCell>
                        <TableCell className="capitalize">{session.location?.replace('_', ' ')}</TableCell>
                        <TableCell>
                          {session.durationMinutes && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {session.durationMinutes} min
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getOutcomeStatusBadge(session.outcomeStatus)}</TableCell>
                        <TableCell>
                          {session.exportedToEE ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              Exported
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <AlertCircle className="w-4 h-4" />
                              Pending
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>E&E Export Batches</CardTitle>
                  <CardDescription>
                    Generate and download exports for Eligibility & Enrollment system
                  </CardDescription>
                </div>
                <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-export">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Export
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create E&E Export</DialogTitle>
                      <DialogDescription>
                        Generate an export batch of client session data
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...exportForm}>
                      <form onSubmit={exportForm.handleSubmit((data) => createExportMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={exportForm.control}
                          name="exportType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Export Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-export-type">
                                    <SelectValue placeholder="Select export type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="manual">Manual</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={exportForm.control}
                          name="exportFormat"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Export Format</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-export-format">
                                    <SelectValue placeholder="Select format" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="csv">CSV</SelectItem>
                                  <SelectItem value="json">JSON</SelectItem>
                                  <SelectItem value="xml">XML</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={exportForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional notes about this export" rows={3} {...field} data-testid="input-export-notes" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createExportMutation.isPending} data-testid="button-submit-export">
                            {createExportMutation.isPending ? "Creating..." : "Create Export"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {exportsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading exports...</div>
              ) : exports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No exports created yet. Click "Create Export" to generate your first batch.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Export Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exportBatch) => (
                      <TableRow key={exportBatch.id} data-testid={`row-export-${exportBatch.id}`}>
                        <TableCell>
                          {format(new Date(exportBatch.exportedAt), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="capitalize">{exportBatch.exportType}</TableCell>
                        <TableCell className="uppercase">{exportBatch.exportFormat}</TableCell>
                        <TableCell>{exportBatch.sessionCount} sessions</TableCell>
                        <TableCell>
                          {exportBatch.uploadedToEE ? (
                            <Badge className="bg-green-100 text-green-800">Uploaded</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Ready</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadExportMutation.mutate(exportBatch)}
                            disabled={downloadExportMutation.isPending}
                            data-testid={`button-download-${exportBatch.id}`}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <DataQualityDashboard 
            sessions={sessions} 
            timeframe="week"
          />
        </TabsContent>
      </Tabs>

      <PolicyChatWidget />
    </div>
  );
}

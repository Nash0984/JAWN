import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Webhook, 
  Plus, 
  Edit, 
  Trash2, 
  TestTube,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Copy
} from "lucide-react";
import { format } from "date-fns";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: string;
  maxRetries: number;
  retryCount: number;
  lastTriggeredAt: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastResponse: any;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WebhookDeliveryLog {
  id: string;
  eventType: string;
  attemptNumber: number;
  httpStatus: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  responseTime: number | null;
  responseBody: string | null;
}

const AVAILABLE_EVENTS = [
  { value: "sms.received", label: "SMS Received" },
  { value: "sms.sent", label: "SMS Sent" },
  { value: "sms.failed", label: "SMS Failed" },
  { value: "application.submitted", label: "Application Submitted" },
  { value: "application.approved", label: "Application Approved" },
  { value: "application.denied", label: "Application Denied" },
  { value: "document.uploaded", label: "Document Uploaded" },
  { value: "document.verified", label: "Document Verified" },
  { value: "document.rejected", label: "Document Rejected" },
  { value: "document.processed", label: "Document Processed" },
  { value: "eligibility.checked", label: "Eligibility Checked" },
  { value: "eligibility.changed", label: "Eligibility Changed" },
  { value: "case.created", label: "Case Created" },
  { value: "case.updated", label: "Case Updated" },
  { value: "case.closed", label: "Case Closed" },
];

export default function WebhookManagement() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
    secret: "",
    maxRetries: 3,
  });

  // Fetch webhooks
  const { data: webhooks, isLoading } = useQuery<Webhook[]>({
    queryKey: ['/api/admin/webhooks'],
  });

  // Fetch logs for selected webhook
  const { data: logs } = useQuery<WebhookDeliveryLog[]>({
    queryKey: ['/api/admin/webhooks', selectedWebhook?.id, 'logs'],
    enabled: !!selectedWebhook && logsDialogOpen,
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/admin/webhooks', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhooks'] });
      setAddDialogOpen(false);
      setFormData({ url: "", events: [], secret: "", maxRetries: 3 });
      toast({
        title: "Success",
        description: "Webhook created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create webhook",
        variant: "destructive",
      });
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest(`/api/admin/webhooks/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhooks'] });
      setEditDialogOpen(false);
      setSelectedWebhook(null);
      toast({
        title: "Success",
        description: "Webhook updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update webhook",
        variant: "destructive",
      });
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/webhooks/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/webhooks'] });
      setDeleteDialogOpen(false);
      setSelectedWebhook(null);
      toast({
        title: "Success",
        description: "Webhook deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete webhook",
        variant: "destructive",
      });
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/admin/webhooks/${id}/test`, 'POST');
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: data.success ? "Success" : "Failed",
        description: data.success 
          ? `Webhook delivered successfully (${data.httpStatus})`
          : data.errorMessage || "Webhook delivery failed",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to test webhook",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = () => {
    if (selectedWebhook) {
      updateMutation.mutate({
        id: selectedWebhook.id,
        ...formData,
      });
    }
  };

  const handleDelete = () => {
    if (selectedWebhook) {
      deleteMutation.mutate(selectedWebhook.id);
    }
  };

  const handleTest = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setTestResult(null);
    testMutation.mutate(webhook.id);
  };

  const openEditDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      maxRetries: webhook.maxRetries,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDeleteDialogOpen(true);
  };

  const openLogsDialog = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setLogsDialogOpen(true);
  };

  const toggleEvent = (eventValue: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue]
    }));
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({
      title: "Copied",
      description: "Secret copied to clipboard",
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-webhook-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Webhook Management</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Configure webhooks for event notifications
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-webhook">
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Webhook</DialogTitle>
              <DialogDescription>
                Configure a new webhook endpoint to receive event notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  data-testid="input-webhook-url"
                />
              </div>

              <div className="space-y-2">
                <Label>Subscribe to Events</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="rounded"
                        data-testid={`checkbox-event-${event.value}`}
                      />
                      <span className="text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.events.length} events
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Webhook Secret (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="secret"
                    type="password"
                    placeholder="Auto-generated if left blank"
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    data-testid="input-webhook-secret"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, secret: crypto.randomUUID() })}
                    data-testid="button-generate-secret"
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Used for HMAC-SHA256 signature verification
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRetries">Max Retries</Label>
                <Select 
                  value={formData.maxRetries.toString()} 
                  onValueChange={(value) => setFormData({ ...formData, maxRetries: parseInt(value) })}
                >
                  <SelectTrigger data-testid="select-max-retries">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (No retries)</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3 (Recommended)</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setAddDialogOpen(false)}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAdd}
                disabled={!formData.url || formData.events.length === 0 || createMutation.isPending}
                data-testid="button-confirm-add"
              >
                {createMutation.isPending ? "Creating..." : "Create Webhook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Webhooks</CardTitle>
          <CardDescription>Manage your webhook endpoints and view delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p data-testid="text-loading">Loading webhooks...</p>
          ) : webhooks && webhooks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Delivery</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id} data-testid={`webhook-row-${webhook.id}`}>
                    <TableCell className="font-mono text-sm max-w-xs truncate" title={webhook.url}>
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`badge-event-count-${webhook.id}`}>
                        {webhook.events.length} events
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {webhook.status === "active" ? (
                        <Badge variant="default" data-testid={`badge-status-${webhook.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-status-${webhook.id}`}>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Paused
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {webhook.lastDeliveryAt ? (
                        <div className="space-y-1">
                          <p className="text-sm" data-testid={`text-last-delivery-${webhook.id}`}>
                            {format(new Date(webhook.lastDeliveryAt), 'MMM d, yyyy HH:mm')}
                          </p>
                          {webhook.lastDeliveryStatus === "success" ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {webhook.failureCount > 0 ? (
                        <Badge variant="destructive" data-testid={`badge-failures-${webhook.id}`}>
                          {webhook.failureCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest(webhook)}
                          disabled={testMutation.isPending}
                          data-testid={`button-test-${webhook.id}`}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLogsDialog(webhook)}
                          data-testid={`button-logs-${webhook.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(webhook)}
                          data-testid={`button-edit-${webhook.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDeleteDialog(webhook)}
                          data-testid={`button-delete-${webhook.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-webhooks">
                No webhooks configured yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update webhook configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-url">Webhook URL</Label>
              <Input
                id="edit-url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                data-testid="input-edit-url"
              />
            </div>

            <div className="space-y-2">
              <Label>Subscribe to Events</Label>
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.value)}
                      onChange={() => toggleEvent(event.value)}
                      className="rounded"
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-secret">Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-secret"
                  type="password"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  data-testid="input-edit-secret"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copySecret(formData.secret)}
                  data-testid="button-copy-secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-maxRetries">Max Retries</Label>
              <Select 
                value={formData.maxRetries.toString()} 
                onValueChange={(value) => setFormData({ ...formData, maxRetries: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEdit}
              disabled={!formData.url || formData.events.length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating..." : "Update Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Delivery Logs</DialogTitle>
            <DialogDescription>
              Recent delivery attempts for this webhook
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[60vh]">
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <Card key={log.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.eventType}</Badge>
                          <Badge variant="secondary">Attempt {log.attemptNumber}</Badge>
                          {log.status === "success" ? (
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                        </p>
                      </div>
                      {log.httpStatus && (
                        <p className="text-sm">
                          HTTP Status: <span className="font-mono">{log.httpStatus}</span>
                        </p>
                      )}
                      {log.responseTime && (
                        <p className="text-sm">
                          Response Time: <span className="font-mono">{log.responseTime}ms</span>
                        </p>
                      )}
                      {log.errorMessage && (
                        <p className="text-sm text-destructive">
                          Error: {log.errorMessage}
                        </p>
                      )}
                      {log.responseBody && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground">
                            Response Body
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {log.responseBody}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No delivery logs yet
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

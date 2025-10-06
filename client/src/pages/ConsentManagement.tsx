import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { FileText, Plus, CheckCircle2, XCircle, Clock, Shield } from "lucide-react";
import { PolicyChatWidget } from "@/components/PolicyChatWidget";
import { format } from "date-fns";

interface ConsentForm {
  id: string;
  formName: string;
  formCode: string;
  formTitle: string;
  formContent: string;
  purpose: string;
  version: number;
  isActive: boolean;
  requiresSignature: boolean;
  expirationDays?: number;
  benefitProgramId?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  effectiveDate?: string;
  endDate?: string;
  createdAt: string;
}

interface ClientConsent {
  id: string;
  clientCaseId: string;
  consentFormId: string;
  sessionId?: string;
  consentGiven: boolean;
  consentDate: string;
  signatureMethod?: string;
  signatureData?: string;
  witnessedBy?: string;
  expiresAt?: string;
  revokedAt?: string;
  notes?: string;
  createdAt: string;
}

const formSchema = z.object({
  formName: z.string().min(1, "Form name is required"),
  formCode: z.string().min(1, "Form code is required"),
  formTitle: z.string().min(1, "Form title is required"),
  formContent: z.string().min(50, "Form content must be at least 50 characters"),
  purpose: z.string().min(10, "Purpose description is required"),
  requiresSignature: z.boolean().default(true),
  expirationDays: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().default(false)
});

type FormData = z.infer<typeof formSchema>;

const consentSchema = z.object({
  clientCaseId: z.string().min(1, "Client case ID is required"),
  consentFormId: z.string().min(1, "Consent form is required"),
  signatureMethod: z.string().optional(),
  notes: z.string().optional()
});

type ConsentData = z.infer<typeof consentSchema>;

export default function ConsentManagement() {
  const { toast } = useToast();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<ConsentForm | null>(null);

  // Fetch consent forms
  const { data: forms = [], isLoading: formsLoading } = useQuery<ConsentForm[]>({
    queryKey: ['/api/consent/forms']
  });

  // Fetch client consents
  const { data: consents = [], isLoading: consentsLoading } = useQuery<ClientConsent[]>({
    queryKey: ['/api/consent/client-consents']
  });

  // Form creation form
  const formForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requiresSignature: true,
      isActive: false
    }
  });

  // Consent collection form
  const consentForm = useForm<ConsentData>({
    resolver: zodResolver(consentSchema),
    defaultValues: {
      signatureMethod: "electronic"
    }
  });

  // Create consent form mutation
  const createFormMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/consent/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create consent form');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consent/forms'] });
      toast({
        title: "Consent form created",
        description: "The consent form has been created successfully"
      });
      setIsFormDialogOpen(false);
      formForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Collect consent mutation
  const collectConsentMutation = useMutation({
    mutationFn: async (data: ConsentData) => {
      const response = await fetch('/api/consent/client-consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          consentGiven: true,
          consentDate: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to record consent');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consent/client-consents'] });
      toast({
        title: "Consent recorded",
        description: "Client consent has been recorded successfully"
      });
      setIsConsentDialogOpen(false);
      consentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getConsentStatus = (consent: ClientConsent) => {
    if (consent.revokedAt) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return <Badge className="bg-yellow-100 text-yellow-800">Expired</Badge>;
    }
    if (consent.consentGiven) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          Consent Form Management
        </h1>
        <p className="text-muted-foreground">
          Create consent forms and manage client consent for SNAP program participation
        </p>
      </div>

      <Tabs defaultValue="forms" className="space-y-6">
        <TabsList data-testid="consent-tabs">
          <TabsTrigger value="forms" data-testid="tab-forms">
            <FileText className="w-4 h-4 mr-2" />
            Consent Forms
          </TabsTrigger>
          <TabsTrigger value="consents" data-testid="tab-consents">
            <Shield className="w-4 h-4 mr-2" />
            Client Consents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Consent Forms</CardTitle>
                  <CardDescription>
                    Create and manage consent forms for benefits program participation
                  </CardDescription>
                </div>
                <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-form">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Form
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Consent Form</DialogTitle>
                      <DialogDescription>
                        Define a new consent form for clients to review and sign
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...formForm}>
                      <form onSubmit={formForm.handleSubmit((data) => createFormMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={formForm.control}
                          name="formName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Form Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Benefits Disclosure Agreement" {...field} data-testid="input-form-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formForm.control}
                          name="formCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Form Code</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., benefits_disclosure" {...field} data-testid="input-form-code" />
                              </FormControl>
                              <FormDescription>
                                Unique identifier for this form (lowercase, underscores only)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formForm.control}
                          name="formTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Form Title</FormLabel>
                              <FormControl>
                                <Input placeholder="Title shown to clients" {...field} data-testid="input-form-title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formForm.control}
                          name="purpose"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purpose</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Explain why this consent is needed" 
                                  rows={2} 
                                  {...field} 
                                  data-testid="input-purpose"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formForm.control}
                          name="formContent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Form Content</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter the full consent form text that clients will review" 
                                  rows={8} 
                                  {...field} 
                                  data-testid="input-form-content"
                                />
                              </FormControl>
                              <FormDescription>
                                This is the content that clients will read before consenting
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={formForm.control}
                            name="requiresSignature"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel>Requires Signature</FormLabel>
                                  <FormDescription>
                                    Client must sign this form
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-requires-signature"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={formForm.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel>Active</FormLabel>
                                  <FormDescription>
                                    Form is ready for use
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-is-active"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={formForm.control}
                          name="expirationDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Period (days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="e.g., 365 (leave blank for no expiration)" 
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : undefined)}
                                  data-testid="input-expiration-days"
                                />
                              </FormControl>
                              <FormDescription>
                                How long this consent remains valid (optional)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createFormMutation.isPending} data-testid="button-submit-form">
                            {createFormMutation.isPending ? "Creating..." : "Create Form"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {formsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading consent forms...</div>
              ) : forms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No consent forms created yet. Click "Create Form" to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((form) => (
                      <TableRow key={form.id} data-testid={`row-form-${form.id}`}>
                        <TableCell className="font-medium">{form.formName}</TableCell>
                        <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{form.formCode}</code></TableCell>
                        <TableCell>v{form.version}</TableCell>
                        <TableCell>
                          {form.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(form.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedForm(form)}
                            data-testid={`button-view-${form.id}`}
                          >
                            View
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

        <TabsContent value="consents" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Client Consents</CardTitle>
                  <CardDescription>
                    Collect and track client consent for program participation
                  </CardDescription>
                </div>
                <Dialog open={isConsentDialogOpen} onOpenChange={setIsConsentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-collect-consent">
                      <Plus className="w-4 h-4 mr-2" />
                      Collect Consent
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Collect Client Consent</DialogTitle>
                      <DialogDescription>
                        Record client consent for a specific form
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...consentForm}>
                      <form onSubmit={consentForm.handleSubmit((data) => collectConsentMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={consentForm.control}
                          name="clientCaseId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client Case ID</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter client case ID" {...field} data-testid="input-consent-case-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={consentForm.control}
                          name="consentFormId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Consent Form</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-consent-form">
                                    <SelectValue placeholder="Select a consent form" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {forms.filter(f => f.isActive).map(form => (
                                    <SelectItem key={form.id} value={form.id}>
                                      {form.formName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={consentForm.control}
                          name="signatureMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Signature Method</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-signature-method">
                                    <SelectValue placeholder="Select signature method" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="electronic">Electronic</SelectItem>
                                  <SelectItem value="verbal">Verbal</SelectItem>
                                  <SelectItem value="physical">Physical (scanned)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={consentForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Optional notes about consent collection" rows={3} {...field} data-testid="input-consent-notes" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={collectConsentMutation.isPending} data-testid="button-submit-consent">
                            {collectConsentMutation.isPending ? "Recording..." : "Record Consent"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading client consents...</div>
              ) : consents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No client consents recorded yet. Click "Collect Consent" to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Case ID</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Consent Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consents.map((consent) => {
                      const form = forms.find(f => f.id === consent.consentFormId);
                      return (
                        <TableRow key={consent.id} data-testid={`row-consent-${consent.id}`}>
                          <TableCell className="font-medium">{consent.clientCaseId}</TableCell>
                          <TableCell>{form?.formName || 'Unknown'}</TableCell>
                          <TableCell>{format(new Date(consent.consentDate), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="capitalize">{consent.signatureMethod || 'N/A'}</TableCell>
                          <TableCell>{getConsentStatus(consent)}</TableCell>
                          <TableCell>
                            {consent.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                {format(new Date(consent.expiresAt), 'MMM d, yyyy')}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedForm && (
        <Dialog open={!!selectedForm} onOpenChange={() => setSelectedForm(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedForm.formTitle}</DialogTitle>
              <DialogDescription>{selectedForm.purpose}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Form Code:</span> <code className="ml-2 bg-muted px-2 py-1 rounded">{selectedForm.formCode}</code>
                </div>
                <div>
                  <span className="font-medium">Version:</span> <span className="ml-2">v{selectedForm.version}</span>
                </div>
                <div>
                  <span className="font-medium">Requires Signature:</span> <span className="ml-2">{selectedForm.requiresSignature ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="font-medium">Expiration:</span> <span className="ml-2">{selectedForm.expirationDays ? `${selectedForm.expirationDays} days` : 'Never'}</span>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50">
                <h4 className="font-medium mb-2">Form Content:</h4>
                <div className="whitespace-pre-wrap text-sm">{selectedForm.formContent}</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <PolicyChatWidget context="consent-management" />
    </div>
  );
}

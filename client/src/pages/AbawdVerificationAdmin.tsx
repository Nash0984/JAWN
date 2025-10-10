import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, FileCheck, AlertTriangle, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface AbawdVerification {
  id: string;
  clientCaseId: string;
  exemptionType: 'homeless' | 'disabled' | 'student' | 'caregiver' | 'employed_20hrs' | 'training_program' | 'medically_certified' | 'other';
  exemptionStatus: 'verified' | 'pending' | 'denied' | 'expired';
  verificationMethod: 'document_review' | 'third_party_verification' | 'self_attestation' | 'database_check';
  documentIds?: string[];
  verificationNotes?: string;
  verifiedBy: string;
  verificationDate: string;
  expirationDate?: string;
  renewalRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form schema with proper validation
const verificationFormSchema = z.object({
  clientCaseId: z.string().min(1, "Client case ID is required"),
  exemptionType: z.enum(['homeless', 'disabled', 'student', 'caregiver', 'employed_20hrs', 'training_program', 'medically_certified', 'other']),
  exemptionStatus: z.enum(['verified', 'pending', 'denied', 'expired']),
  verificationMethod: z.enum(['document_review', 'third_party_verification', 'self_attestation', 'database_check']),
  verificationNotes: z.string().optional(),
  expirationDate: z.string().optional(),
  renewalRequired: z.boolean().optional()
});

type VerificationFormValues = z.infer<typeof verificationFormSchema>;

export default function AbawdVerificationAdmin() {
  const { toast } = useToast();
  const [filterClientCase, setFilterClientCase] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Build filter params for the URL
  const buildFilterUrl = () => {
    const params = new URLSearchParams();
    if (filterClientCase) params.append("clientCaseId", filterClientCase);
    if (filterStatus) params.append("exemptionStatus", filterStatus);
    if (filterType) params.append("exemptionType", filterType);
    const queryString = params.toString();
    return queryString ? `/api/abawd-verifications?${queryString}` : "/api/abawd-verifications";
  };

  // Fetch verifications with proper filter URL
  const { data: verifications = [], isLoading } = useQuery<AbawdVerification[]>({
    queryKey: ["/api/abawd-verifications", filterClientCase, filterStatus, filterType],
    queryFn: async () => {
      const response = await fetch(buildFilterUrl(), { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch verifications");
      return response.json();
    }
  });

  // Initialize form with react-hook-form and zod validation
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      clientCaseId: "",
      exemptionType: "homeless",
      exemptionStatus: "pending",
      verificationMethod: "document_review",
      verificationNotes: "",
      expirationDate: "",
      renewalRequired: false
    }
  });

  // Create verification mutation
  const createMutation = useMutation({
    mutationFn: async (data: VerificationFormValues) => {
      return apiRequest("/api/abawd-verifications", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/abawd-verifications"] });
      toast({
        title: "Verification Created",
        description: "ABAWD exemption verification has been created successfully."
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update verification mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AbawdVerification> }) => {
      return apiRequest(`/api/abawd-verifications/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/abawd-verifications"] });
      toast({
        title: "Verification Updated",
        description: "ABAWD exemption verification has been updated successfully."
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

  const onSubmit = (data: VerificationFormValues) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      verified: { icon: CheckCircle2, variant: "default" as const, text: "Verified" },
      pending: { icon: Clock, variant: "secondary" as const, text: "Pending" },
      denied: { icon: XCircle, variant: "destructive" as const, text: "Denied" },
      expired: { icon: AlertTriangle, variant: "outline" as const, text: "Expired" }
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const getExemptionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      homeless: "Homeless",
      disabled: "Disabled",
      student: "Student",
      caregiver: "Caregiver",
      employed_20hrs: "Employed 20+ hrs/week",
      training_program: "Training Program",
      medically_certified: "Medically Certified",
      other: "Other"
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ABAWD Exemption Verifications</h1>
          <p className="text-muted-foreground mt-2">
            Manage SNAP ABAWD (Able-Bodied Adults Without Dependents) work requirement exemption verifications
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-verification">
              <Plus className="h-4 w-4 mr-2" />
              New Verification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create ABAWD Exemption Verification</DialogTitle>
              <DialogDescription>
                Document and verify SNAP work requirement exemptions for eligible clients
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientCaseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Case ID</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-client-case-id" placeholder="Enter client case ID" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="exemptionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exemption Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-exemption-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="homeless">Homeless</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="caregiver">Caregiver</SelectItem>
                            <SelectItem value="employed_20hrs">Employed 20+ hrs/week</SelectItem>
                            <SelectItem value="training_program">Training Program</SelectItem>
                            <SelectItem value="medically_certified">Medically Certified</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="verificationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-verification-method">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="document_review">Document Review</SelectItem>
                            <SelectItem value="third_party_verification">Third-Party Verification</SelectItem>
                            <SelectItem value="self_attestation">Self-Attestation</SelectItem>
                            <SelectItem value="database_check">Database Check</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="verificationNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="textarea-verification-notes"
                          placeholder="Enter verification details, supporting documentation, etc."
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-expiration-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-verification"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Verification"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filter Verifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterClientCase">Client Case ID</Label>
              <Input
                id="filterClientCase"
                data-testid="input-filter-client-case"
                value={filterClientCase}
                onChange={(e) => setFilterClientCase(e.target.value)}
                placeholder="Filter by case ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterStatus">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filterType">Exemption Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="homeless">Homeless</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                  <SelectItem value="employed_20hrs">Employed 20+ hrs</SelectItem>
                  <SelectItem value="training_program">Training Program</SelectItem>
                  <SelectItem value="medically_certified">Medically Certified</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verifications List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : verifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No verifications found. Create a new verification to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          verifications.map((verification) => (
            <Card key={verification.id} data-testid={`card-verification-${verification.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      Case ID: {verification.clientCaseId}
                      {getStatusBadge(verification.exemptionStatus)}
                    </CardTitle>
                    <CardDescription>
                      {getExemptionTypeLabel(verification.exemptionType)} exemption
                    </CardDescription>
                  </div>
                  <Select
                    value={verification.exemptionStatus}
                    onValueChange={(value) => updateMutation.mutate({ id: verification.id, updates: { exemptionStatus: value as any } })}
                  >
                    <SelectTrigger className="w-[180px]" data-testid={`select-status-${verification.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Verification Method:</span>
                      <p className="font-medium mt-1 capitalize">
                        {verification.verificationMethod.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification Date:</span>
                      <p className="font-medium mt-1">
                        {format(new Date(verification.verificationDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {verification.expirationDate && (
                      <div>
                        <span className="text-muted-foreground">Expiration Date:</span>
                        <p className="font-medium mt-1">
                          {format(new Date(verification.expirationDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>
                  {verification.verificationNotes && (
                    <div>
                      <span className="text-sm text-muted-foreground">Notes:</span>
                      <p className="mt-1 text-sm bg-muted p-3 rounded-md">
                        {verification.verificationNotes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

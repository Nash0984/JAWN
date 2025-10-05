import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ExportButton } from "@/components/ExportButton";

interface SnapCategoricalEligibility {
  id: string;
  benefitProgramId: string;
  programType: string;
  programName: string;
  description?: string;
  autoQualifies: boolean;
  incomeTestRequired: boolean;
  assetTestRequired: boolean;
  eligibilityCriteria?: string;
  notes?: string;
  effectiveDate: string;
  expirationDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function CategoricalEligibilityManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEligibility, setEditingEligibility] = useState<SnapCategoricalEligibility | null>(null);
  const { toast } = useToast();
  
  const { data: eligibilities = [], isLoading } = useQuery<SnapCategoricalEligibility[]>({
    queryKey: ["/api/rules/categorical"],
  });

  const form = useForm({
    defaultValues: {
      programType: "",
      programName: "",
      description: "",
      autoQualifies: false,
      incomeTestRequired: false,
      assetTestRequired: false,
      eligibilityCriteria: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingEligibility) {
        return apiRequest("PATCH", `/api/rules/categorical/${editingEligibility.id}`, data);
      } else {
        return apiRequest("POST", "/api/rules/categorical", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/categorical"] });
      toast({
        title: "Success",
        description: `Categorical eligibility ${editingEligibility ? "updated" : "created"} successfully`,
      });
      setIsDialogOpen(false);
      setEditingEligibility(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save categorical eligibility. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (eligibility: SnapCategoricalEligibility) => {
    setEditingEligibility(eligibility);
    form.reset({
      programType: eligibility.programType,
      programName: eligibility.programName,
      description: eligibility.description || "",
      autoQualifies: eligibility.autoQualifies,
      incomeTestRequired: eligibility.incomeTestRequired,
      assetTestRequired: eligibility.assetTestRequired,
      eligibilityCriteria: eligibility.eligibilityCriteria || "",
      notes: eligibility.notes || "",
      effectiveDate: eligibility.effectiveDate.split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingEligibility(null);
    form.reset({
      programType: "",
      programName: "",
      description: "",
      autoQualifies: false,
      incomeTestRequired: false,
      assetTestRequired: false,
      eligibilityCriteria: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const programTypes = [
    "SSI (Supplemental Security Income)",
    "TANF (Temporary Assistance for Needy Families)",
    "GA (General Assistance)",
    "TDAP (Temporary Disability Assistance Program)",
    "PAA (Public Assistance to Adults)",
    "BCA (Burial and Cremation Assistance)",
    "SNAP E&T (Employment and Training)",
    "Other Federal Program",
    "Other State Program"
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Categorical Eligibility</CardTitle>
            <CardDescription>
              Manage automatic qualification rules for households receiving other benefits (Manual Section 106)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={eligibilities}
              filename="snap-categorical-eligibility"
              title="SNAP Categorical Eligibility Rules"
              columns={[
                { header: "Program Type", key: "programType" },
                { header: "Program Name", key: "programName" },
                { header: "Description", key: "description" },
                { 
                  header: "Auto-Qualifies", 
                  key: "autoQualifies",
                  format: (val) => val ? "Yes" : "No"
                },
                { 
                  header: "Income Test Required", 
                  key: "incomeTestRequired",
                  format: (val) => val ? "Yes" : "No"
                },
                { 
                  header: "Asset Test Required", 
                  key: "assetTestRequired",
                  format: (val) => val ? "Yes" : "No"
                },
                { header: "Eligibility Criteria", key: "eligibilityCriteria" },
                { header: "Notes", key: "notes" },
                { 
                  header: "Effective Date", 
                  key: "effectiveDate",
                  format: (val) => new Date(val).toLocaleDateString()
                },
                { 
                  header: "Status", 
                  key: "isActive",
                  format: (val) => val ? "Active" : "Inactive"
                },
              ]}
              size="sm"
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleNew} data-testid="button-add-categorical">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Eligibility Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingEligibility ? "Edit Categorical Eligibility" : "Add Categorical Eligibility"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="programType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Program Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-program-type">
                                <SelectValue placeholder="Select program type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {programTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="programName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Program Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g., Maryland SSI Recipients" 
                              data-testid="input-program-name" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Brief description of the program and its eligibility impact"
                              className="min-h-[80px]"
                              data-testid="textarea-description" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3">
                      <Label>Qualification Settings</Label>
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="autoQualifies"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-auto-qualifies"
                                />
                              </FormControl>
                              <FormLabel className="!mt-0 font-normal">
                                Automatically qualifies for SNAP
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="incomeTestRequired"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-income-test"
                                />
                              </FormControl>
                              <FormLabel className="!mt-0 font-normal">
                                Income test still required
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="assetTestRequired"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-asset-test"
                                />
                              </FormControl>
                              <FormLabel className="!mt-0 font-normal">
                                Asset test still required
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="eligibilityCriteria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Eligibility Criteria</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Specific criteria that must be met for this categorical eligibility"
                              className="min-h-[100px]"
                              data-testid="textarea-criteria" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Manual Section 106.1, Updated FY2024" data-testid="input-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="effectiveDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-effective-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                        {saveMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : eligibilities.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No categorical eligibility rules configured. Click "Add Eligibility Rule" to create the first one.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Tests Required</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibilities.map((eligibility: SnapCategoricalEligibility) => (
                <TableRow key={eligibility.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{eligibility.programName}</div>
                      <div className="text-xs text-muted-foreground">{eligibility.programType}</div>
                      {eligibility.description && (
                        <div className="text-xs text-muted-foreground mt-1">{eligibility.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {eligibility.autoQualifies ? (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Auto-Qualifies
                      </Badge>
                    ) : (
                      <Badge variant="outline">Manual Review</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {eligibility.incomeTestRequired && (
                        <Badge variant="secondary" className="text-xs">Income</Badge>
                      )}
                      {eligibility.assetTestRequired && (
                        <Badge variant="secondary" className="text-xs">Assets</Badge>
                      )}
                      {!eligibility.incomeTestRequired && !eligibility.assetTestRequired && (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm truncate" title={eligibility.eligibilityCriteria}>
                      {eligibility.eligibilityCriteria || "—"}
                    </div>
                    {eligibility.notes && (
                      <div className="text-xs text-muted-foreground mt-1">{eligibility.notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(eligibility.effectiveDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={eligibility.isActive ? "default" : "secondary"}>
                      {eligibility.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(eligibility)}
                        data-testid={`button-edit-${eligibility.id}`}
                      >
                        <Edit className="h-4 w-4" />
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
  );
}
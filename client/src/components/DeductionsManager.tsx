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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ExportButton } from "@/components/ExportButton";

interface SnapDeduction {
  id: string;
  benefitProgramId: string;
  deductionType: string;
  amount?: number;
  percentage?: number;
  maxAmount?: number;
  minAmount?: number;
  householdSizeMin?: number;
  householdSizeMax?: number;
  notes?: string;
  effectiveDate: string;
  expirationDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function DeductionsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<SnapDeduction | null>(null);
  const { toast } = useToast();
  
  const { data: deductions = [], isLoading } = useQuery<SnapDeduction[]>({
    queryKey: ["/api/rules/deductions"],
  });

  const form = useForm({
    defaultValues: {
      deductionType: "",
      amount: "",
      percentage: "",
      maxAmount: "",
      minAmount: "",
      householdSizeMin: "",
      householdSizeMax: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        amount: data.amount ? Math.round(parseFloat(data.amount) * 100) : null,
        percentage: data.percentage ? parseFloat(data.percentage) : null,
        maxAmount: data.maxAmount ? Math.round(parseFloat(data.maxAmount) * 100) : null,
        minAmount: data.minAmount ? Math.round(parseFloat(data.minAmount) * 100) : null,
        householdSizeMin: data.householdSizeMin ? parseInt(data.householdSizeMin) : null,
        householdSizeMax: data.householdSizeMax ? parseInt(data.householdSizeMax) : null,
      };
      
      if (editingDeduction) {
        return apiRequest("PATCH", `/api/rules/deductions/${editingDeduction.id}`, payload);
      } else {
        return apiRequest("POST", "/api/rules/deductions", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/deductions"] });
      toast({
        title: "Success",
        description: `Deduction ${editingDeduction ? "updated" : "created"} successfully`,
      });
      setIsDialogOpen(false);
      setEditingDeduction(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save deduction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rules/deductions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/deductions"] });
      toast({
        title: "Success",
        description: "Deduction deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete deduction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (deduction: SnapDeduction) => {
    setEditingDeduction(deduction);
    form.reset({
      deductionType: deduction.deductionType,
      amount: deduction.amount ? (deduction.amount / 100).toString() : "",
      percentage: deduction.percentage?.toString() || "",
      maxAmount: deduction.maxAmount ? (deduction.maxAmount / 100).toString() : "",
      minAmount: deduction.minAmount ? (deduction.minAmount / 100).toString() : "",
      householdSizeMin: deduction.householdSizeMin?.toString() || "",
      householdSizeMax: deduction.householdSizeMax?.toString() || "",
      notes: deduction.notes || "",
      effectiveDate: deduction.effectiveDate.split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingDeduction(null);
    form.reset({
      deductionType: "",
      amount: "",
      percentage: "",
      maxAmount: "",
      minAmount: "",
      householdSizeMin: "",
      householdSizeMax: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const deductionTypes = [
    "Standard Deduction",
    "Earned Income Deduction",
    "Dependent Care",
    "Medical Expenses (Elderly/Disabled)",
    "Shelter Costs",
    "Homeless Shelter Deduction",
    "Utility Allowance",
    "Child Support Payment",
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deductions</CardTitle>
            <CardDescription>
              Manage SNAP deduction rules and allowances (Manual Section 204.4)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={deductions}
              filename="snap-deductions"
              title="SNAP Deductions"
              columns={[
                { header: "Deduction Type", key: "deductionType" },
                { 
                  header: "Amount", 
                  key: "amount",
                  format: (val) => val ? `$${(val / 100).toFixed(2)}` : "—"
                },
                { 
                  header: "Percentage", 
                  key: "percentage",
                  format: (val) => val ? `${val}%` : "—"
                },
                { 
                  header: "Max Amount", 
                  key: "maxAmount",
                  format: (val) => val ? `$${(val / 100).toFixed(2)}` : "—"
                },
                { 
                  header: "Min Amount", 
                  key: "minAmount",
                  format: (val) => val ? `$${(val / 100).toFixed(2)}` : "—"
                },
                { 
                  header: "Household Size", 
                  key: "householdSizeMin",
                  format: (val: any) => val ? `${val}+` : "All"
                },
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
                <Button onClick={handleNew} data-testid="button-add-deduction">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deduction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingDeduction ? "Edit Deduction" : "Add Deduction"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="deductionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deduction Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-deduction-type">
                                <SelectValue placeholder="Select deduction type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {deductionTypes.map((type) => (
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fixed Amount ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-amount" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="percentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Percentage (%)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="1" 
                                placeholder="20" 
                                data-testid="input-percentage" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="minAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Amount ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-min-amount" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Amount ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-max-amount" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="householdSizeMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min Household Size</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="1" 
                                placeholder="1" 
                                data-testid="input-household-min" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="householdSizeMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Household Size</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="1" 
                                placeholder="10" 
                                data-testid="input-household-max" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Manual Section 204.4" data-testid="input-notes" />
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
        ) : deductions.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No deductions configured. Click "Add Deduction" to create the first one.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount/Percentage</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Household Size</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.map((deduction: SnapDeduction) => (
                <TableRow key={deduction.id}>
                  <TableCell>
                    <div className="font-medium">{deduction.deductionType}</div>
                    {deduction.notes && (
                      <div className="text-xs text-muted-foreground">{deduction.notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {deduction.amount && <div>${(deduction.amount / 100).toFixed(2)}</div>}
                    {deduction.percentage && <div>{deduction.percentage}%</div>}
                  </TableCell>
                  <TableCell>
                    {deduction.minAmount && (
                      <div className="text-sm">Min: ${(deduction.minAmount / 100).toFixed(2)}</div>
                    )}
                    {deduction.maxAmount && (
                      <div className="text-sm">Max: ${(deduction.maxAmount / 100).toFixed(2)}</div>
                    )}
                    {!deduction.minAmount && !deduction.maxAmount && "—"}
                  </TableCell>
                  <TableCell>
                    {deduction.householdSizeMin && deduction.householdSizeMax ? (
                      `${deduction.householdSizeMin}-${deduction.householdSizeMax}`
                    ) : deduction.householdSizeMin ? (
                      `${deduction.householdSizeMin}+`
                    ) : (
                      "All"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(deduction.effectiveDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={deduction.isActive ? "default" : "secondary"}>
                      {deduction.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(deduction)}
                        data-testid={`button-edit-${deduction.id}`}
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
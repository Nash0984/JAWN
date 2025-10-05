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
import { Plus, Edit, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ExportButton } from "@/components/ExportButton";

interface SnapIncomeLimit {
  id: string;
  benefitProgramId: string;
  householdSize: number;
  grossMonthlyLimit: number;
  netMonthlyLimit: number;
  notes: string | null;
  effectiveDate: string;
  endDate: string | null;
  isActive: boolean;
}

interface IncomeLimitForm {
  householdSize: number;
  grossMonthlyIncomeLimit: number;
  netMonthlyIncomeLimit: number;
  manualSection: string;
  effectiveDate: string;
}

export function IncomeLimitsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<SnapIncomeLimit | null>(null);
  const { toast } = useToast();

  const form = useForm<IncomeLimitForm>({
    defaultValues: {
      householdSize: 1,
      grossMonthlyIncomeLimit: 0,
      netMonthlyIncomeLimit: 0,
      manualSection: "115",
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  });

  // Get Maryland SNAP program ID
  const { data: programsData } = useQuery({
    queryKey: ["/api/programs"],
  });

  const snapProgram = (programsData as any)?.data?.find((p: any) => p.code === "MD_SNAP");
  const benefitProgramId = snapProgram?.id;

  // Fetch income limits
  const { data: limitsData, isLoading } = useQuery({
    queryKey: ["/api/rules/income-limits", benefitProgramId],
    enabled: !!benefitProgramId,
  });

  const limits: SnapIncomeLimit[] = (limitsData as any)?.data || [];

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: IncomeLimitForm) => {
      const payload = {
        ...data,
        benefitProgramId,
        grossMonthlyIncomeLimit: Math.round(data.grossMonthlyIncomeLimit * 100),
        netMonthlyIncomeLimit: Math.round(data.netMonthlyIncomeLimit * 100),
      };

      if (editingLimit) {
        const response = await apiRequest("PATCH", `/api/rules/income-limits/${editingLimit.id}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/rules/income-limits", payload);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/income-limits"] });
      toast({
        title: editingLimit ? "Income limit updated" : "Income limit created",
        description: "The income limit has been saved successfully.",
      });
      setIsDialogOpen(false);
      setEditingLimit(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to save income limit",
        description: "Please check the form and try again.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  const handleEdit = (limit: SnapIncomeLimit) => {
    setEditingLimit(limit);
    const manualSection = limit.notes?.match(/Manual Section: (\d+)/)?.[1] || "115";
    form.reset({
      householdSize: limit.householdSize,
      grossMonthlyIncomeLimit: limit.grossMonthlyLimit / 100,
      netMonthlyIncomeLimit: limit.netMonthlyLimit / 100,
      manualSection,
      effectiveDate: limit.effectiveDate.split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingLimit(null);
    form.reset({
      householdSize: 1,
      grossMonthlyIncomeLimit: 0,
      netMonthlyIncomeLimit: 0,
      manualSection: "115",
      effectiveDate: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: IncomeLimitForm) => {
    saveMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Income Limits</CardTitle>
            <CardDescription>
              Manage gross and net monthly income limits by household size (Manual Section 115)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={limits}
              filename="snap-income-limits"
              title="SNAP Income Limits"
              columns={[
                { header: "Household Size", key: "householdSize" },
                { 
                  header: "Gross Income Limit", 
                  key: "grossMonthlyLimit",
                  format: (val) => `$${(val / 100).toFixed(2)}`
                },
                { 
                  header: "Net Income Limit", 
                  key: "netMonthlyLimit",
                  format: (val) => `$${(val / 100).toFixed(2)}`
                },
                { 
                  header: "Manual Section", 
                  key: "notes",
                  format: (val) => val?.match(/Manual Section: (\d+)/)?.[1] || "—"
                },
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
                <Button onClick={handleNew} data-testid="button-add-income-limit">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Income Limit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingLimit ? "Edit Income Limit" : "Add Income Limit"}
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="householdSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Household Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-household-size"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="grossMonthlyIncomeLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Monthly Income Limit ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              data-testid="input-gross-income-limit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="netMonthlyIncomeLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net Monthly Income Limit ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              data-testid="input-net-income-limit"
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
                      name="manualSection"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Manual Section</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 115" data-testid="input-manual-section" />
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
                  </div>

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
        ) : limits.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No income limits configured. Click "Add Income Limit" to create the first one.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Household Size</TableHead>
                <TableHead>Gross Income Limit</TableHead>
                <TableHead>Net Income Limit</TableHead>
                <TableHead>Manual Section</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map((limit) => {
                const manualSection = limit.notes?.match(/Manual Section: (\d+)/)?.[1] || "—";
                return (
                  <TableRow key={limit.id} data-testid={`row-income-limit-${limit.householdSize}`}>
                    <TableCell className="font-medium">{limit.householdSize}</TableCell>
                    <TableCell>${(limit.grossMonthlyLimit / 100).toFixed(2)}</TableCell>
                    <TableCell>${(limit.netMonthlyLimit / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{manualSection}</Badge>
                    </TableCell>
                    <TableCell>{new Date(limit.effectiveDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {limit.isActive ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(limit)}
                        data-testid={`button-edit-${limit.householdSize}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

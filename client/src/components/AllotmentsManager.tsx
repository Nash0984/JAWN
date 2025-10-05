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
import { Plus, Edit, CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ExportButton } from "@/components/ExportButton";

interface SnapAllotment {
  id: string;
  benefitProgramId: string;
  householdSize: number;
  maxAllotment: number;
  minAllotment: number;
  standardAllotment?: number;
  emergencyAllotment?: number;
  notes?: string;
  effectiveDate: string;
  expirationDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function AllotmentsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAllotment, setEditingAllotment] = useState<SnapAllotment | null>(null);
  const { toast } = useToast();
  
  const { data: allotments = [], isLoading } = useQuery<SnapAllotment[]>({
    queryKey: ["/api/rules/allotments"],
  });

  const form = useForm({
    defaultValues: {
      householdSize: "",
      maxAllotment: "",
      minAllotment: "",
      standardAllotment: "",
      emergencyAllotment: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        householdSize: parseInt(data.householdSize),
        maxAllotment: Math.round(parseFloat(data.maxAllotment) * 100),
        minAllotment: Math.round(parseFloat(data.minAllotment) * 100),
        standardAllotment: data.standardAllotment ? Math.round(parseFloat(data.standardAllotment) * 100) : null,
        emergencyAllotment: data.emergencyAllotment ? Math.round(parseFloat(data.emergencyAllotment) * 100) : null,
      };
      
      if (editingAllotment) {
        return apiRequest("PATCH", `/api/rules/allotments/${editingAllotment.id}`, payload);
      } else {
        return apiRequest("POST", "/api/rules/allotments", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/allotments"] });
      toast({
        title: "Success",
        description: `Allotment ${editingAllotment ? "updated" : "created"} successfully`,
      });
      setIsDialogOpen(false);
      setEditingAllotment(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save allotment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (allotment: SnapAllotment) => {
    setEditingAllotment(allotment);
    form.reset({
      householdSize: allotment.householdSize.toString(),
      maxAllotment: (allotment.maxAllotment / 100).toString(),
      minAllotment: (allotment.minAllotment / 100).toString(),
      standardAllotment: allotment.standardAllotment ? (allotment.standardAllotment / 100).toString() : "",
      emergencyAllotment: allotment.emergencyAllotment ? (allotment.emergencyAllotment / 100).toString() : "",
      notes: allotment.notes || "",
      effectiveDate: allotment.effectiveDate.split('T')[0],
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingAllotment(null);
    form.reset({
      householdSize: "",
      maxAllotment: "",
      minAllotment: "",
      standardAllotment: "",
      emergencyAllotment: "",
      notes: "",
      effectiveDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  // Sort allotments by household size for display
  const sortedAllotments = [...allotments].sort((a: SnapAllotment, b: SnapAllotment) => a.householdSize - b.householdSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Benefit Allotments</CardTitle>
            <CardDescription>
              Manage monthly benefit amounts by household size (Manual Section 501)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={sortedAllotments}
              filename="snap-allotments"
              title="SNAP Benefit Allotments"
              columns={[
                { header: "Household Size", key: "householdSize" },
                { 
                  header: "Maximum Benefit", 
                  key: "maxAllotment",
                  format: (val) => `$${(val / 100).toFixed(2)}`
                },
                { 
                  header: "Minimum Benefit", 
                  key: "minAllotment",
                  format: (val) => `$${(val / 100).toFixed(2)}`
                },
                { 
                  header: "Standard Benefit", 
                  key: "standardAllotment",
                  format: (val) => val ? `$${(val / 100).toFixed(2)}` : "—"
                },
                { 
                  header: "Emergency Benefit", 
                  key: "emergencyAllotment",
                  format: (val) => val ? `$${(val / 100).toFixed(2)}` : "—"
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
                <Button onClick={handleNew} data-testid="button-add-allotment">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Allotment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAllotment ? "Edit Allotment" : "Add Allotment"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="householdSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Household Size</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              step="1" 
                              placeholder="1" 
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
                        name="maxAllotment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Benefit ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-max-allotment" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="minAllotment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Benefit ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-min-allotment" 
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
                        name="standardAllotment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Standard Benefit ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-standard-allotment" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergencyAllotment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Emergency Benefit ($)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00" 
                                data-testid="input-emergency-allotment" 
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
                            <Input {...field} placeholder="e.g., Manual Section 501, FY2024 rates" data-testid="input-notes" />
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
        ) : allotments.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No allotments configured. Click "Add Allotment" to create the first one.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Household Size</TableHead>
                <TableHead>Maximum Benefit</TableHead>
                <TableHead>Minimum Benefit</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Emergency</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAllotments.map((allotment: SnapAllotment) => (
                <TableRow key={allotment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{allotment.householdSize}</div>
                      {allotment.householdSize === 1 && (
                        <Badge variant="outline" className="text-xs">Single</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {(allotment.maxAllotment / 100).toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>${(allotment.minAllotment / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    {allotment.standardAllotment ? (
                      `$${(allotment.standardAllotment / 100).toFixed(2)}`
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {allotment.emergencyAllotment ? (
                      `$${(allotment.emergencyAllotment / 100).toFixed(2)}`
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(allotment.effectiveDate).toLocaleDateString()}
                    {allotment.notes && (
                      <div className="text-xs text-muted-foreground">{allotment.notes}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={allotment.isActive ? "default" : "secondary"}>
                      {allotment.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(allotment)}
                        data-testid={`button-edit-${allotment.id}`}
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
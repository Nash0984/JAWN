import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calculator, Trash2, Edit, TrendingUp, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { HouseholdScenario, ScenarioCalculation } from "@shared/schema";

const householdDataSchema = z.object({
  adults: z.coerce.number().min(0),
  children: z.coerce.number().min(0),
  employmentIncome: z.coerce.number().min(0),
  unearnedIncome: z.coerce.number().min(0).optional(),
  stateCode: z.string().default("MD"),
  householdAssets: z.coerce.number().min(0).optional(),
  rentOrMortgage: z.coerce.number().min(0).optional(),
  utilityCosts: z.coerce.number().min(0).optional(),
  medicalExpenses: z.coerce.number().min(0).optional(),
  childcareExpenses: z.coerce.number().min(0).optional(),
  elderlyOrDisabled: z.boolean().optional(),
});

const scenarioFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  clientIdentifier: z.string().optional(),
  tags: z.string().optional(),
}).merge(householdDataSchema);

type ScenarioFormData = z.infer<typeof scenarioFormSchema>;

export default function ScenarioWorkspace() {
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<HouseholdScenario | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch scenarios
  const { data: scenarios = [], isLoading } = useQuery<HouseholdScenario[]>({
    queryKey: ["/api/scenarios"],
  });

  // Fetch calculations for selected scenario
  const { data: calculations = [] } = useQuery<ScenarioCalculation[]>({
    queryKey: ["/api/scenarios", selectedScenario?.id, "calculations"],
    enabled: !!selectedScenario,
  });

  const latestCalculation = calculations[0]; // Calculations are ordered by calculatedAt desc

  // Create scenario mutation
  const createScenarioMutation = useMutation({
    mutationFn: async (data: ScenarioFormData) => {
      const { name, description, clientIdentifier, tags, ...householdData } = data;
      return await apiRequest("/api/scenarios", "POST", {
        name,
        description,
        clientIdentifier,
        tags: tags ? tags.split(",").map(t => t.trim()) : [],
        householdData,
        stateCode: "MD",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Scenario created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update scenario mutation
  const updateScenarioMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScenarioFormData> }) => {
      const { name, description, clientIdentifier, tags, ...householdData } = data;
      return await apiRequest(`/api/scenarios/${id}`, "PATCH", {
        name,
        description,
        clientIdentifier,
        tags: tags ? (typeof tags === 'string' ? tags.split(",").map(t => t.trim()) : tags) : undefined,
        householdData: Object.keys(householdData).length > 0 ? householdData : undefined,
      }) as Promise<HouseholdScenario>;
    },
    onSuccess: (updatedScenario: HouseholdScenario) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      setSelectedScenario(updatedScenario); // Update selected scenario with fresh data
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Scenario updated successfully",
      });
    },
  });

  // Calculate scenario mutation
  const calculateScenarioMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return await apiRequest(`/api/scenarios/${scenarioId}/calculate`, "POST", {});
    },
    onSuccess: (_, scenarioId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios", scenarioId, "calculations"] });
      toast({
        title: "Success",
        description: "Benefits calculated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete scenario mutation
  const deleteScenarioMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return await apiRequest(`/api/scenarios/${scenarioId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scenarios"] });
      setSelectedScenario(null);
      toast({
        title: "Success",
        description: "Scenario deleted successfully",
      });
    },
  });

  const createForm = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: {
      name: "",
      description: "",
      adults: 1,
      children: 0,
      employmentIncome: 0,
      unearnedIncome: 0,
      stateCode: "MD",
      householdAssets: 0,
      rentOrMortgage: 0,
      utilityCosts: 0,
      medicalExpenses: 0,
      childcareExpenses: 0,
      elderlyOrDisabled: false,
    },
  });

  const editForm = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
  });

  const onCreateSubmit = (data: ScenarioFormData) => {
    createScenarioMutation.mutate(data);
  };

  const onEditSubmit = (data: ScenarioFormData) => {
    if (selectedScenario) {
      updateScenarioMutation.mutate({ id: selectedScenario.id, data });
    }
  };

  const handleEditScenario = (scenario: HouseholdScenario) => {
    const householdData = scenario.householdData as any;
    editForm.reset({
      name: scenario.name,
      description: scenario.description || "",
      clientIdentifier: scenario.clientIdentifier || "",
      tags: scenario.tags?.join(", ") || "",
      adults: householdData.adults,
      children: householdData.children,
      employmentIncome: householdData.employmentIncome,
      unearnedIncome: householdData.unearnedIncome || 0,
      stateCode: householdData.stateCode || "MD",
      householdAssets: householdData.householdAssets || 0,
      rentOrMortgage: householdData.rentOrMortgage || 0,
      utilityCosts: householdData.utilityCosts || 0,
      medicalExpenses: householdData.medicalExpenses || 0,
      childcareExpenses: householdData.childcareExpenses || 0,
      elderlyOrDisabled: householdData.elderlyOrDisabled || false,
    });
    setSelectedScenario(scenario);
    setIsEditDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Household Scenario Workspace</h1>
          <p className="text-muted-foreground mt-1">
            Model different household configurations and compare benefit outcomes
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-scenario">
              <Plus className="mr-2 h-4 w-4" />
              Create Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Scenario</DialogTitle>
              <DialogDescription>
                Create a what-if scenario to model household benefits
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scenario Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Client A - With Job" data-testid="input-scenario-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Notes about this scenario..." data-testid="input-scenario-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="clientIdentifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID / Case Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" data-testid="input-client-identifier" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (comma-separated)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., employment-change, disability" data-testid="input-tags" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                <h3 className="font-semibold text-lg">Household Configuration</h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="adults"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adults *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-adults" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="children"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Children *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-children" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="employmentIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Employment Income *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-employment-income" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="unearnedIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Unearned Income</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-unearned-income" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="householdAssets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Household Assets</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-household-assets" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="rentOrMortgage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent/Mortgage</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-rent-mortgage" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="utilityCosts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Utilities</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-utility-costs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="medicalExpenses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Medical Expenses</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-medical-expenses" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="childcareExpenses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Childcare</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-childcare-expenses" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createScenarioMutation.isPending} data-testid="button-submit-create">
                    {createScenarioMutation.isPending ? "Creating..." : "Create Scenario"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenarios List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scenarios</CardTitle>
              <CardDescription>{scenarios.length} total scenarios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : scenarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scenarios yet. Create one to get started.</p>
              ) : (
                scenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedScenario?.id === scenario.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`scenario-card-${scenario.id}`}
                  >
                    <h4 className="font-semibold text-sm">{scenario.name}</h4>
                    {scenario.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scenario.description}</p>
                    )}
                    {scenario.tags && scenario.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {scenario.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scenario Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedScenario ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedScenario.name}</CardTitle>
                      <CardDescription className="mt-2">
                        {selectedScenario.description || "No description"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditScenario(selectedScenario)}
                        data-testid="button-edit-scenario"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => calculateScenarioMutation.mutate(selectedScenario.id)}
                        disabled={calculateScenarioMutation.isPending}
                        data-testid="button-calculate-scenario"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        {calculateScenarioMutation.isPending ? "Calculating..." : "Calculate"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteScenarioMutation.mutate(selectedScenario.id)}
                        data-testid="button-delete-scenario"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Household Composition</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Adults: {(selectedScenario.householdData as any).adults}</div>
                        <div>Children: {(selectedScenario.householdData as any).children}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">Income</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Employment: {formatCurrency((selectedScenario.householdData as any).employmentIncome)}/mo</div>
                        <div>Unearned: {formatCurrency((selectedScenario.householdData as any).unearnedIncome || 0)}/mo</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-2">Expenses</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Rent/Mortgage: {formatCurrency((selectedScenario.householdData as any).rentOrMortgage || 0)}/mo</div>
                        <div>Utilities: {formatCurrency((selectedScenario.householdData as any).utilityCosts || 0)}/mo</div>
                        <div>Medical: {formatCurrency((selectedScenario.householdData as any).medicalExpenses || 0)}/mo</div>
                        <div>Childcare: {formatCurrency((selectedScenario.householdData as any).childcareExpenses || 0)}/mo</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Latest Calculation */}
              {latestCalculation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Benefit Calculation Results
                    </CardTitle>
                    <CardDescription>
                      Calculated on {new Date(latestCalculation.calculatedAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">SNAP</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(latestCalculation.snapAmount || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>

                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">Medicaid</div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {latestCalculation.medicaidEligible ? "Eligible" : "Not Eligible"}
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">EITC</div>
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                          {formatCurrency(latestCalculation.eitcAmount || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">per year</div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">Child Tax Credit</div>
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                          {formatCurrency(latestCalculation.childTaxCreditAmount || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">per year</div>
                      </div>

                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">SSI</div>
                        <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                          {formatCurrency(latestCalculation.ssiAmount || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>

                      <div className="p-4 bg-rose-50 dark:bg-rose-950 rounded-lg">
                        <div className="text-sm text-muted-foreground">TANF</div>
                        <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                          {formatCurrency(latestCalculation.tanfAmount || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Monthly Benefits</div>
                        <div className="text-3xl font-bold flex items-center gap-2">
                          <DollarSign className="h-6 w-6" />
                          {formatCurrency(latestCalculation.totalMonthlyBenefits || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total Yearly Benefits</div>
                        <div className="text-3xl font-bold flex items-center gap-2">
                          <DollarSign className="h-6 w-6" />
                          {formatCurrency(latestCalculation.totalYearlyBenefits || 0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Select a scenario to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scenario</DialogTitle>
            <DialogDescription>Update scenario details and household configuration</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scenario Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Client A - With Job" data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Notes about this scenario..." data-testid="input-edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="clientIdentifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID / Case Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional" data-testid="input-edit-client-id" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (comma-separated)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., employment-change, disability" data-testid="input-edit-tags" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <h3 className="font-semibold text-lg">Household Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="adults"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adults *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-adults" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="children"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Children *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-children" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="employmentIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Employment Income *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-employment-income" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="unearnedIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Unearned Income</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-unearned-income" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="householdAssets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Household Assets</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-assets" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="rentOrMortgage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Rent/Mortgage</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-rent" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="utilityCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Utilities</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-utilities" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="medicalExpenses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Medical Expenses</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-medical" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="childcareExpenses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Childcare</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-edit-childcare" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateScenarioMutation.isPending} data-testid="button-submit-edit">
                  {updateScenarioMutation.isPending ? "Updating..." : "Update Scenario"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

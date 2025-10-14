import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Save, FileText, Calculator, Users } from "lucide-react";
import { FinancialOpportunityRadar } from "@/components/FinancialOpportunityRadar";

// Profile mode type
type ProfileMode = "combined" | "benefits_only" | "tax_only";

// Dependent schema
const dependentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ssn: z.string().optional(),
  dateOfBirth: z.string().optional(),
  relationship: z.string().optional(),
  disabled: z.boolean().default(false),
});

// Main form schema with conditional validation
const householdProfileSchema = z.object({
  // Basic info (all modes)
  name: z.string().min(1, "Profile name is required"),
  profileMode: z.enum(["combined", "benefits_only", "tax_only"]),
  householdSize: z.coerce.number().min(1, "Household size must be at least 1"),
  stateCode: z.string().default("MD"),
  county: z.string().optional(),

  // Income (all modes)
  employmentIncome: z.coerce.number().min(0).default(0),
  unearnedIncome: z.coerce.number().min(0).default(0),
  selfEmploymentIncome: z.coerce.number().min(0).default(0),

  // Benefits fields (benefits_only and combined)
  householdAssets: z.coerce.number().min(0).default(0),
  rentOrMortgage: z.coerce.number().min(0).default(0),
  utilityCosts: z.coerce.number().min(0).default(0),
  medicalExpenses: z.coerce.number().min(0).default(0),
  childcareExpenses: z.coerce.number().min(0).default(0),
  elderlyOrDisabled: z.boolean().default(false),

  // Tax fields (tax_only and combined)
  filingStatus: z.string().optional(),
  taxpayerFirstName: z.string().optional(),
  taxpayerLastName: z.string().optional(),
  taxpayerSSN: z.string().optional(),
  taxpayerDateOfBirth: z.string().optional(),
  taxpayerBlind: z.boolean().default(false),
  taxpayerDisabled: z.boolean().default(false),
  spouseFirstName: z.string().optional(),
  spouseLastName: z.string().optional(),
  spouseSSN: z.string().optional(),
  spouseDateOfBirth: z.string().optional(),
  spouseBlind: z.boolean().default(false),
  spouseDisabled: z.boolean().default(false),
  streetAddress: z.string().optional(),
  aptNumber: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  dependents: z.array(dependentSchema).default([]),
  wageWithholding: z.coerce.number().min(0).default(0),
  estimatedTaxPayments: z.coerce.number().min(0).default(0),

  // Optional fields
  clientCaseId: z.string().optional(),
  clientIdentifier: z.string().optional(),
  notes: z.string().optional(),
});

type HouseholdProfileFormData = z.infer<typeof householdProfileSchema>;

export default function HouseholdProfiler() {
  const { toast } = useToast();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [dependentList, setDependentList] = useState<z.infer<typeof dependentSchema>[]>([]);

  // Fetch all profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["/api/household-profiles"],
  });

  // Fetch selected profile
  const { data: selectedProfile } = useQuery({
    queryKey: ["/api/household-profiles", selectedProfileId],
    enabled: !!selectedProfileId,
  });

  // Form setup
  const form = useForm<HouseholdProfileFormData>({
    resolver: zodResolver(householdProfileSchema),
    defaultValues: {
      name: "",
      profileMode: "combined",
      householdSize: 1,
      stateCode: "MD",
      employmentIncome: 0,
      unearnedIncome: 0,
      selfEmploymentIncome: 0,
      householdAssets: 0,
      rentOrMortgage: 0,
      utilityCosts: 0,
      medicalExpenses: 0,
      childcareExpenses: 0,
      elderlyOrDisabled: false,
      taxpayerBlind: false,
      taxpayerDisabled: false,
      spouseBlind: false,
      spouseDisabled: false,
      dependents: [],
      wageWithholding: 0,
      estimatedTaxPayments: 0,
    },
  });

  const profileMode = form.watch("profileMode");
  const filingStatus = form.watch("filingStatus");

  // Update form when profile is selected
  useEffect(() => {
    if (selectedProfile) {
      form.reset({
        ...selectedProfile as any,
        dependents: (selectedProfile as any).dependents || [],
      });
      setDependentList((selectedProfile as any).dependents || []);
    }
  }, [selectedProfile, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: HouseholdProfileFormData) => {
      return await apiRequest<{ id: string }>("/api/household-profiles", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-profiles"] });
      toast({
        title: "Profile Created",
        description: "Your household profile has been saved successfully.",
        action: (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/navigator"} data-testid="button-use-navigator">
              Use in Navigator
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/tax"} data-testid="button-use-tax">
              Use in Tax Prep
            </Button>
          </div>
        ),
      });
      setSelectedProfileId(data.id);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HouseholdProfileFormData> }) => {
      return await apiRequest(`/api/household-profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-profiles"] });
      toast({
        title: "Profile Updated",
        description: "Changes have been saved successfully.",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/household-profiles/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-profiles"] });
      toast({
        title: "Profile Deleted",
        description: "The household profile has been deleted.",
      });
      setSelectedProfileId(null);
      form.reset();
    },
  });

  const onSubmit = (data: HouseholdProfileFormData) => {
    const formData = { ...data, dependents: dependentList };
    
    if (selectedProfileId) {
      updateMutation.mutate({ id: selectedProfileId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addDependent = () => {
    setDependentList([
      ...dependentList,
      { name: "", ssn: "", dateOfBirth: "", relationship: "", disabled: false },
    ]);
  };

  const removeDependent = (index: number) => {
    setDependentList(dependentList.filter((_, i) => i !== index));
  };

  const updateDependent = (index: number, field: keyof z.infer<typeof dependentSchema>, value: any) => {
    const updated = [...dependentList];
    updated[index] = { ...updated[index], [field]: value };
    setDependentList(updated);
  };

  const showBenefitsSection = profileMode === "benefits_only" || profileMode === "combined";
  const showTaxSection = profileMode === "tax_only" || profileMode === "combined";

  // Watch form values for real-time radar updates
  const watchedValues = useWatch({ control: form.control });
  
  // Build household data for radar widget
  const householdData = {
    adults: 1, // Default to 1 adult (taxpayer)
    children: dependentList.filter(d => d.relationship === 'child' || d.relationship === 'son' || d.relationship === 'daughter').length,
    elderlyOrDisabled: watchedValues.elderlyOrDisabled || false,
    employmentIncome: Number(watchedValues.employmentIncome) || 0,
    unearnedIncome: Number(watchedValues.unearnedIncome) || 0,
    selfEmploymentIncome: Number(watchedValues.selfEmploymentIncome) || 0,
    householdAssets: Number(watchedValues.householdAssets) || 0,
    rentOrMortgage: Number(watchedValues.rentOrMortgage) || 0,
    utilityCosts: Number(watchedValues.utilityCosts) || 0,
    medicalExpenses: Number(watchedValues.medicalExpenses) || 0,
    childcareExpenses: Number(watchedValues.childcareExpenses) || 0,
    filingStatus: watchedValues.filingStatus as any,
    wageWithholding: Number(watchedValues.wageWithholding) || 0,
    stateCode: "MD",
    year: new Date().getFullYear()
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" data-testid="page-title">Household Profiler</h1>
          <p className="text-muted-foreground mt-2">
            Create unified household profiles for benefits screening and tax preparation
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Profile List Sidebar */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Saved Profiles</CardTitle>
              <CardDescription>Select or create a new profile</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => {
                  setSelectedProfileId(null);
                  form.reset();
                  setDependentList([]);
                }}
                className="w-full mb-4"
                variant="outline"
                data-testid="button-new-profile"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Profile
              </Button>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {profilesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : profiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No profiles yet</p>
                  ) : (
                    profiles.map((profile: any) => (
                      <Button
                        key={profile.id}
                        variant={selectedProfileId === profile.id ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => setSelectedProfileId(profile.id)}
                        data-testid={`profile-item-${profile.id}`}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        <div className="flex-1 text-left truncate">
                          <div className="font-medium truncate">{profile.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {profile.profileMode.replace("_", " ")}
                          </div>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle>
                {selectedProfileId ? "Edit Profile" : "New Profile"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Mode Toggle */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <FormField
                        control={form.control}
                        name="profileMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">Profile Mode</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3"
                                data-testid="radio-profile-mode"
                              >
                                <Label
                                  htmlFor="combined"
                                  className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent ${
                                    field.value === "combined" ? "border-primary bg-primary/10" : ""
                                  }`}
                                >
                                  <RadioGroupItem value="combined" id="combined" data-testid="radio-mode-combined" />
                                  <div>
                                    <div className="font-medium">Combined</div>
                                    <div className="text-xs text-muted-foreground">Benefits + Tax</div>
                                  </div>
                                </Label>
                                <Label
                                  htmlFor="benefits_only"
                                  className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent ${
                                    field.value === "benefits_only" ? "border-primary bg-primary/10" : ""
                                  }`}
                                >
                                  <RadioGroupItem value="benefits_only" id="benefits_only" data-testid="radio-mode-benefits" />
                                  <div>
                                    <div className="font-medium">Benefits Only</div>
                                    <div className="text-xs text-muted-foreground">SNAP, Medicaid, etc.</div>
                                  </div>
                                </Label>
                                <Label
                                  htmlFor="tax_only"
                                  className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent ${
                                    field.value === "tax_only" ? "border-primary bg-primary/10" : ""
                                  }`}
                                >
                                  <RadioGroupItem value="tax_only" id="tax_only" data-testid="radio-mode-tax" />
                                  <div>
                                    <div className="font-medium">Tax Only</div>
                                    <div className="text-xs text-muted-foreground">VITA, Tax Prep</div>
                                  </div>
                                </Label>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Section 1: Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profile Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Smith Family" {...field} data-testid="input-profile-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="householdSize"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Household Size *</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} data-testid="input-household-size" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="stateCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="county"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>County</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Baltimore" {...field} data-testid="input-county" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 2: Income */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Income Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="employmentIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employment Income</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-employment-income" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="unearnedIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unearned Income</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-unearned-income" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="selfEmploymentIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Self-Employment Income</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-self-employment-income" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 3: Benefits Details (conditional) */}
                  {showBenefitsSection && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Benefits Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="householdAssets"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Household Assets</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-household-assets" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="rentOrMortgage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rent/Mortgage</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-rent" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="utilityCosts"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Utility Costs</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-utilities" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="medicalExpenses"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Medical Expenses</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-medical" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="childcareExpenses"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Childcare Expenses</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-childcare" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="elderlyOrDisabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Elderly or Disabled</FormLabel>
                                  <div className="text-sm text-muted-foreground">Household member 60+ or disabled</div>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-elderly-disabled"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 4: Tax Personal Info (conditional) */}
                  {showTaxSection && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Tax Personal Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="filingStatus"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Filing Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-filing-status">
                                    <SelectValue placeholder="Select filing status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="single" data-testid="option-filing-single">Single</SelectItem>
                                  <SelectItem value="married_joint" data-testid="option-filing-married-joint">Married Filing Jointly</SelectItem>
                                  <SelectItem value="married_separate" data-testid="option-filing-married-separate">Married Filing Separately</SelectItem>
                                  <SelectItem value="head_of_household" data-testid="option-filing-head-of-household">Head of Household</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div>
                          <h4 className="font-semibold mb-4">Taxpayer Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="taxpayerFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-taxpayer-first-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="taxpayerLastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-taxpayer-last-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="taxpayerSSN"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SSN</FormLabel>
                                  <FormControl>
                                    <Input placeholder="XXX-XX-XXXX" {...field} data-testid="input-taxpayer-ssn" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="taxpayerDateOfBirth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of Birth</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} data-testid="input-taxpayer-dob" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="taxpayerBlind"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-taxpayer-blind"
                                    />
                                  </FormControl>
                                  <FormLabel className="!mt-0">Blind</FormLabel>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="taxpayerDisabled"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-taxpayer-disabled"
                                    />
                                  </FormControl>
                                  <FormLabel className="!mt-0">Disabled</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {filingStatus === "married_joint" && (
                          <div>
                            <Separator className="my-4" />
                            <h4 className="font-semibold mb-4">Spouse Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="spouseFirstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-spouse-first-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="spouseLastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-spouse-last-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="spouseSSN"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>SSN</FormLabel>
                                    <FormControl>
                                      <Input placeholder="XXX-XX-XXXX" {...field} data-testid="input-spouse-ssn" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="spouseDateOfBirth"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Date of Birth</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} data-testid="input-spouse-dob" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="spouseBlind"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        data-testid="switch-spouse-blind"
                                      />
                                    </FormControl>
                                    <FormLabel className="!mt-0">Blind</FormLabel>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="spouseDisabled"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        data-testid="switch-spouse-disabled"
                                      />
                                    </FormControl>
                                    <FormLabel className="!mt-0">Disabled</FormLabel>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <Separator className="my-4" />
                          <h4 className="font-semibold mb-4">Address</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="streetAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Street Address</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-street-address" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="aptNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Apt/Unit</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-apt" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-city" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ZIP Code</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-zip" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 5: Dependents (conditional) */}
                  {showTaxSection && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Dependents</CardTitle>
                          <Button type="button" onClick={addDependent} size="sm" data-testid="button-add-dependent">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Dependent
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {dependentList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No dependents added yet</p>
                        ) : (
                          dependentList.map((dependent, index) => (
                            <Card key={index}>
                              <CardContent className="pt-6">
                                <div className="flex items-start justify-between mb-4">
                                  <h5 className="font-medium">Dependent {index + 1}</h5>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDependent(index)}
                                    data-testid={`button-remove-dependent-${index}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Name</Label>
                                    <Input
                                      value={dependent.name}
                                      onChange={(e) => updateDependent(index, "name", e.target.value)}
                                      data-testid={`input-dependent-name-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <Label>SSN</Label>
                                    <Input
                                      value={dependent.ssn}
                                      onChange={(e) => updateDependent(index, "ssn", e.target.value)}
                                      placeholder="XXX-XX-XXXX"
                                      data-testid={`input-dependent-ssn-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <Label>Date of Birth</Label>
                                    <Input
                                      type="date"
                                      value={dependent.dateOfBirth}
                                      onChange={(e) => updateDependent(index, "dateOfBirth", e.target.value)}
                                      data-testid={`input-dependent-dob-${index}`}
                                    />
                                  </div>
                                  <div>
                                    <Label>Relationship</Label>
                                    <Input
                                      value={dependent.relationship}
                                      onChange={(e) => updateDependent(index, "relationship", e.target.value)}
                                      placeholder="e.g., Child"
                                      data-testid={`input-dependent-relationship-${index}`}
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={dependent.disabled}
                                      onCheckedChange={(checked) => updateDependent(index, "disabled", checked)}
                                      data-testid={`switch-dependent-disabled-${index}`}
                                    />
                                    <Label>Disabled</Label>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 6: Tax Withholding (conditional) */}
                  {showTaxSection && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Tax Withholding</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="wageWithholding"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Wage Withholding</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-wage-withholding" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="estimatedTaxPayments"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estimated Tax Payments</FormLabel>
                                <FormControl>
                                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} data-testid="input-estimated-tax" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 justify-end">
                    {selectedProfileId && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this profile?")) {
                            deleteMutation.mutate(selectedProfileId);
                          }
                        }}
                        data-testid="button-delete"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {selectedProfileId ? "Update Profile" : "Save Profile"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Financial Opportunity Radar - Real-time eligibility tracking */}
          <div className="xl:col-span-3">
            <div className="sticky top-4">
              <FinancialOpportunityRadar 
                householdData={householdData}
                data-testid="opportunity-radar"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

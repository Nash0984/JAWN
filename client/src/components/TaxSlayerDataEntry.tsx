import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Plus, Save, Trash2, FileText, DollarSign, Building, Calculator, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTenant } from "@/contexts/TenantContext";

// TaxSlayer data entry schema
const taxslayerEntrySchema = z.object({
  vitaIntakeSessionId: z.string(),
  taxYear: z.number().min(2020).max(2030),
  filingStatus: z.enum(["single", "married_joint", "married_separate", "head_of_household", "qualifying_widow"]),
  preparedDate: z.string().optional(),
  
  // Federal return
  federalAGI: z.number().default(0),
  federalTaxableIncome: z.number().default(0),
  federalTax: z.number().default(0),
  federalWithheld: z.number().default(0),
  federalRefund: z.number().default(0),
  
  // State return
  stateAGI: z.number().default(0),
  stateTax: z.number().default(0),
  stateWithheld: z.number().default(0),
  stateRefund: z.number().default(0),
  
  // Credits
  eitcAmount: z.number().default(0),
  ctcAmount: z.number().default(0),
  additionalChildTaxCredit: z.number().default(0),
  americanOpportunityCredit: z.number().default(0),
  lifetimeLearningCredit: z.number().default(0),
  educationCredits: z.number().default(0),
  otherCredits: z.number().default(0),
  
  // W-2 forms array
  w2Forms: z.array(z.object({
    employer: z.string(),
    ein: z.string().optional(),
    wages: z.number(),
    federalWithheld: z.number().default(0),
    stateWithheld: z.number().default(0),
    socialSecurityWages: z.number().optional(),
    medicareWages: z.number().optional(),
  })).default([]),
  
  // 1099 forms array
  form1099s: z.array(z.object({
    type: z.string(), // INT, DIV, MISC, NEC, etc
    payer: z.string(),
    amount: z.number(),
    federalWithheld: z.number().default(0),
  })).default([]),
  
  // Schedule C (self-employment)
  scheduleC: z.object({
    businessName: z.string(),
    ein: z.string().optional(),
    grossReceipts: z.number(),
    expenses: z.number(),
    netProfit: z.number(),
  }).optional(),
  
  // Other income/deductions
  retirementIncome: z.number().default(0),
  socialSecurityIncome: z.number().default(0),
  studentLoanInterestPaid: z.number().default(0),
  mortgageInterestPaid: z.number().default(0),
  charitableContributions: z.number().default(0),
  
  notes: z.string().optional(),
});

type TaxslayerEntryForm = z.infer<typeof taxslayerEntrySchema>;

interface TaxSlayerDataEntryProps {
  vitaSessionId: string;
  taxYear?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaxSlayerDataEntry({ vitaSessionId, taxYear = new Date().getFullYear() - 1, onSuccess, onCancel }: TaxSlayerDataEntryProps) {
  const { stateConfig } = useTenant();
  const stateCode = stateConfig?.stateCode || 'STATE';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const form = useForm<TaxslayerEntryForm>({
    resolver: zodResolver(taxslayerEntrySchema),
    defaultValues: {
      vitaIntakeSessionId: vitaSessionId,
      taxYear,
      filingStatus: "single",
      federalAGI: 0,
      federalTaxableIncome: 0,
      federalTax: 0,
      federalWithheld: 0,
      federalRefund: 0,
      stateAGI: 0,
      stateTax: 0,
      stateWithheld: 0,
      stateRefund: 0,
      eitcAmount: 0,
      ctcAmount: 0,
      additionalChildTaxCredit: 0,
      americanOpportunityCredit: 0,
      lifetimeLearningCredit: 0,
      educationCredits: 0,
      otherCredits: 0,
      w2Forms: [],
      form1099s: [],
      retirementIncome: 0,
      socialSecurityIncome: 0,
      studentLoanInterestPaid: 0,
      mortgageInterestPaid: 0,
      charitableContributions: 0,
    },
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`taxslayer-entry-${vitaSessionId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        form.reset(data);
        toast({
          title: "Draft Loaded",
          description: "Your previously saved draft has been restored.",
        });
      } catch (e) {
        // console.error("Failed to load saved draft:", e);
      }
    }
  }, [vitaSessionId]);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const interval = setInterval(() => {
      const currentData = form.getValues();
      localStorage.setItem(`taxslayer-entry-${vitaSessionId}`, JSON.stringify(currentData));
      setLastSaved(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoSaveEnabled, vitaSessionId]);

  const importMutation = useMutation({
    mutationFn: async (data: TaxslayerEntryForm) => {
      return await apiRequest<any>("/api/taxslayer/import", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxslayer", vitaSessionId] });
      localStorage.removeItem(`taxslayer-entry-${vitaSessionId}`);
      
      toast({
        title: "TaxSlayer Data Imported",
        description: data.hasValidationWarnings 
          ? `Data saved with ${data.validationWarnings?.length} warnings`
          : "Data successfully imported",
      });
      
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import TaxSlayer data",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaxslayerEntryForm) => {
    // Calculate education credits total if not provided
    if (data.educationCredits === 0) {
      data.educationCredits = (data.americanOpportunityCredit || 0) + (data.lifetimeLearningCredit || 0);
    }
    
    importMutation.mutate(data);
  };

  // W-2 form management
  const addW2Form = () => {
    const currentW2s = form.getValues("w2Forms");
    form.setValue("w2Forms", [...currentW2s, {
      employer: "",
      wages: 0,
      federalWithheld: 0,
      stateWithheld: 0,
    }]);
  };

  const removeW2Form = (index: number) => {
    const currentW2s = form.getValues("w2Forms");
    form.setValue("w2Forms", currentW2s.filter((_, i) => i !== index));
  };

  // 1099 form management
  const add1099Form = () => {
    const current1099s = form.getValues("form1099s");
    form.setValue("form1099s", [...current1099s, {
      type: "INT",
      payer: "",
      amount: 0,
      federalWithheld: 0,
    }]);
  };

  const remove1099Form = (index: number) => {
    const current1099s = form.getValues("form1099s");
    form.setValue("form1099s", current1099s.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-taxslayer-title">Import TaxSlayer Return Data</h2>
          <p className="text-sm text-muted-foreground">Manually enter data from TaxSlayer Pro</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Saved {lastSaved.toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          TaxSlayer Pro has no API. Please manually enter the return data from TaxSlayer's final review screen.
          Data is auto-saved every 30 seconds to prevent loss.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Accordion type="multiple" defaultValue={["federal", "state", "credits"]} className="space-y-4">
            {/* Federal Return Section */}
            <AccordionItem value="federal">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Federal Return
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="taxYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Year</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} data-testid="input-tax-year" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="filingStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Filing Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-filing-status">
                                  <SelectValue placeholder="Select filing status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="married_joint">Married Filing Jointly</SelectItem>
                                <SelectItem value="married_separate">Married Filing Separately</SelectItem>
                                <SelectItem value="head_of_household">Head of Household</SelectItem>
                                <SelectItem value="qualifying_widow">Qualifying Widow(er)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="federalAGI"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Adjusted Gross Income (AGI)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-federal-agi"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="federalTaxableIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taxable Income</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-federal-taxable-income"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="federalTax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Federal Tax</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-federal-tax"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="federalWithheld"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Federal Withholding</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-federal-withheld"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="federalRefund"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Federal Refund/Owed</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-federal-refund"
                              />
                            </FormControl>
                            <FormDescription>Positive = Refund, Negative = Owed</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preparedDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prepared Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-prepared-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* State Return Section */}
            <AccordionItem value="state">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {stateCode} State Return
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="stateAGI"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{stateCode} AGI</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-state-agi"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="stateTax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State Tax</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-state-tax"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="stateWithheld"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State Withholding</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-state-withheld"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="stateRefund"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State Refund/Owed</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-state-refund"
                              />
                            </FormControl>
                            <FormDescription>Positive = Refund, Negative = Owed</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* Tax Credits Section */}
            <AccordionItem value="credits">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Tax Credits
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="eitcAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Earned Income Tax Credit (EITC)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-eitc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ctcAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Child Tax Credit (CTC)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-ctc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="additionalChildTaxCredit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Child Tax Credit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-additional-ctc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="americanOpportunityCredit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>American Opportunity Credit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-aotc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lifetimeLearningCredit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lifetime Learning Credit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-llc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="otherCredits"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other Credits</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid="input-other-credits"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* W-2 Forms Section */}
            <AccordionItem value="w2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  W-2 Income ({form.watch("w2Forms")?.length || 0})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {form.watch("w2Forms")?.map((_, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">W-2 #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeW2Form(index)}
                            data-testid={`button-remove-w2-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`w2Forms.${index}.employer`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Employer Name</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid={`input-w2-employer-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`w2Forms.${index}.ein`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>EIN (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid={`input-w2-ein-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`w2Forms.${index}.wages`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Wages</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-w2-wages-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`w2Forms.${index}.federalWithheld`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Federal Withholding</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-w2-federal-withheld-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`w2Forms.${index}.stateWithheld`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State Withholding</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-w2-state-withheld-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addW2Form} className="w-full" data-testid="button-add-w2">
                      <Plus className="h-4 w-4 mr-2" />
                      Add W-2 Form
                    </Button>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* 1099 Forms Section */}
            <AccordionItem value="1099">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  1099 Income ({form.watch("form1099s")?.length || 0})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {form.watch("form1099s")?.map((_, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">1099 #{index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove1099Form(index)}
                            data-testid={`button-remove-1099-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`form1099s.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>1099 Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid={`select-1099-type-${index}`}>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="INT">1099-INT (Interest)</SelectItem>
                                    <SelectItem value="DIV">1099-DIV (Dividends)</SelectItem>
                                    <SelectItem value="MISC">1099-MISC</SelectItem>
                                    <SelectItem value="NEC">1099-NEC (Non-Employee Comp)</SelectItem>
                                    <SelectItem value="R">1099-R (Retirement)</SelectItem>
                                    <SelectItem value="SSA">SSA-1099 (Social Security)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`form1099s.${index}.payer`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Payer Name</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid={`input-1099-payer-${index}`} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`form1099s.${index}.amount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Amount</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-1099-amount-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`form1099s.${index}.federalWithheld`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Federal Withholding</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    data-testid={`input-1099-withheld-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={add1099Form} className="w-full" data-testid="button-add-1099">
                      <Plus className="h-4 w-4 mr-2" />
                      Add 1099 Form
                    </Button>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* Notes Section */}
            <AccordionItem value="notes">
              <AccordionTrigger className="text-lg font-semibold">Notes</AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="pt-6">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={4}
                              placeholder="Any additional notes or discrepancies..."
                              data-testid="textarea-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={importMutation.isPending} className="flex-1" data-testid="button-import">
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Import TaxSlayer Data
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}

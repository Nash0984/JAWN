import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, DollarSign, Heart, Baby, Home, Users, Calculator, Info, ArrowRight, Save } from "lucide-react";

const screenerSchema = z.object({
  adults: z.coerce.number().min(1, "At least 1 adult required").max(20),
  children: z.coerce.number().min(0).max(20),
  employmentIncome: z.coerce.number().min(0, "Income cannot be negative"),
  unearnedIncome: z.coerce.number().min(0).optional(),
  stateCode: z.string().length(2, "Please select a state"),
  householdAssets: z.coerce.number().min(0).optional(),
  rentOrMortgage: z.coerce.number().min(0).optional(),
  utilityCosts: z.coerce.number().min(0).optional(),
  medicalExpenses: z.coerce.number().min(0).optional(),
  childcareExpenses: z.coerce.number().min(0).optional(),
  elderlyOrDisabled: z.boolean().optional()
});

type ScreenerFormData = z.infer<typeof screenerSchema>;

interface BenefitResult {
  snap: number;
  medicaid: boolean;
  eitc: number;
  childTaxCredit: number;
  ssi: number;
  tanf: number;
  householdNetIncome: number;
  householdTax: number;
  householdBenefits: number;
  marginalTaxRate: number;
}

interface ScreenerResponse {
  success: boolean;
  benefits: BenefitResult;
  summary: string;
  error?: string;
}

// Generate or retrieve session ID
function getSessionId(): string {
  let sessionId = localStorage.getItem('screener_session_id');
  if (!sessionId) {
    sessionId = `screener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('screener_session_id', sessionId);
  }
  return sessionId;
}

export default function BenefitScreener() {
  const [, setLocation] = useLocation();
  const [results, setResults] = useState<ScreenerResponse | null>(null);
  const [sessionId] = useState(getSessionId());
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ScreenerFormData>({
    resolver: zodResolver(screenerSchema),
    defaultValues: {
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
      elderlyOrDisabled: false
    }
  });

  const calculateMutation = useMutation({
    mutationFn: async (data: ScreenerFormData) => {
      const response = await apiRequest("POST", "/api/policyengine/summary", data);
      return await response.json() as ScreenerResponse;
    },
    onSuccess: (data) => {
      setResults(data);
    }
  });

  // Auto-save mutation - saves results after calculation
  const saveMutation = useMutation({
    mutationFn: async (data: { householdData: ScreenerFormData; benefitResults: ScreenerResponse }) => {
      const response = await apiRequest("POST", "/api/screener/save", {
        sessionId,
        householdData: data.householdData,
        benefitResults: data.benefitResults
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setSavedSessionId(data.id);
      toast({
        title: "Results Saved",
        description: "Your screening results have been saved. Create an account to keep them permanently.",
      });
    }
  });

  // Claim session mutation - associates anonymous session with user account
  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/screener/sessions/${sessionId}/claim`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Results Saved to Account",
        description: "Your screening results are now saved to your account!",
      });
      setLocation("/dashboard/client");
    },
    onError: (error: any) => {
      if (error.message?.includes("401")) {
        // Not logged in - redirect to signup with return path
        setLocation(`/signup?return=/screener`);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to save results to account",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: ScreenerFormData) => {
    calculateMutation.mutate(data);
  };

  // Auto-save results when calculation succeeds
  useEffect(() => {
    if (results?.success && !savedSessionId) {
      const householdData = form.getValues();
      saveMutation.mutate({ householdData, benefitResults: results });
    }
  }, [results]);

  const totalMonthlyBenefits = results?.benefits ? 
    (results.benefits.snap + results.benefits.ssi + results.benefits.tanf) : 0;

  const totalYearlyBenefits = results?.benefits ?
    (results.benefits.eitc + results.benefits.childTaxCredit) : 0;

  const eligibleCount = results?.benefits ? [
    results.benefits.snap > 0,
    results.benefits.medicaid,
    results.benefits.eitc > 0,
    results.benefits.childTaxCredit > 0,
    results.benefits.ssi > 0,
    results.benefits.tanf > 0
  ].filter(Boolean).length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Multi-Benefit Eligibility Screener
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Find out which benefits your household may qualify for
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Badge variant="outline" className="text-sm">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              No login required
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Info className="w-3 h-3 mr-1" />
              Completely anonymous
            </Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Screener Form */}
          <Card data-testid="card-screener-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Household Information
              </CardTitle>
              <CardDescription>
                Enter your household details to see which benefits you may qualify for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Household Size */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adults"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adults (18+)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              data-testid="input-adults"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="children"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Children (Under 18)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              data-testid="input-children"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Income */}
                  <FormField
                    control={form.control}
                    name="employmentIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Income (Annual)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            data-testid="input-employment-income"
                          />
                        </FormControl>
                        <FormDescription>
                          Total wages, salaries, and self-employment income per year
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unearnedIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Other Income (Annual)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            data-testid="input-unearned-income"
                          />
                        </FormControl>
                        <FormDescription>
                          Interest, dividends, Social Security, retirement income
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* State */}
                  <FormField
                    control={form.control}
                    name="stateCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MD">Maryland</SelectItem>
                            <SelectItem value="DC">Washington DC</SelectItem>
                            <SelectItem value="VA">Virginia</SelectItem>
                            <SelectItem value="PA">Pennsylvania</SelectItem>
                            <SelectItem value="DE">Delaware</SelectItem>
                            <SelectItem value="NY">New York</SelectItem>
                            <SelectItem value="CA">California</SelectItem>
                            <SelectItem value="TX">Texas</SelectItem>
                            <SelectItem value="FL">Florida</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Optional Details */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Additional Details (Optional)</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="rentOrMortgage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Rent/Mortgage (Monthly)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                className="h-8 text-sm"
                                data-testid="input-rent"
                              />
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
                            <FormLabel className="text-xs">Utilities (Monthly)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                className="h-8 text-sm"
                                data-testid="input-utilities"
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
                        name="medicalExpenses"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Medical Expenses (Monthly)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                className="h-8 text-sm"
                                data-testid="input-medical"
                              />
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
                            <FormLabel className="text-xs">Childcare (Monthly)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field} 
                                className="h-8 text-sm"
                                data-testid="input-childcare"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="elderlyOrDisabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-elderly-disabled"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs">
                              Household includes elderly (60+) or disabled member
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={calculateMutation.isPending}
                    data-testid="button-calculate"
                  >
                    {calculateMutation.isPending ? "Calculating..." : "Calculate Benefits"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-4">
            {!results && (
              <Card className="border-dashed" data-testid="card-empty-results">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Calculator className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-gray-500">
                    Enter your household information and click "Calculate Benefits" to see your results
                  </p>
                </CardContent>
              </Card>
            )}

            {results?.error && (
              <Alert variant="destructive" data-testid="alert-error">
                <AlertDescription>{results.error}</AlertDescription>
              </Alert>
            )}

            {results?.success && (
              <>
                {/* Summary Card */}
                <Card data-testid="card-results-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Your Benefit Estimate
                    </CardTitle>
                    <CardDescription>
                      You may be eligible for {eligibleCount} benefit program{eligibleCount !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Benefits</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-monthly-benefits">
                          ${totalMonthlyBenefits.toFixed(0)}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Yearly Tax Credits</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-yearly-benefits">
                          ${totalYearlyBenefits.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Individual Benefits */}
                <Card data-testid="card-benefit-details">
                  <CardHeader>
                    <CardTitle>Benefit Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {results.benefits.snap > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-snap">
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium">SNAP (Food Assistance)</p>
                            <p className="text-sm text-gray-500">Monthly benefit</p>
                          </div>
                        </div>
                        <p className="font-bold text-blue-600">${results.benefits.snap.toFixed(0)}/mo</p>
                      </div>
                    )}

                    {results.benefits.medicaid && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-medicaid">
                        <div className="flex items-center gap-3">
                          <Heart className="w-5 h-5 text-red-600" />
                          <div>
                            <p className="font-medium">Medicaid</p>
                            <p className="text-sm text-gray-500">Health coverage</p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">Eligible</Badge>
                      </div>
                    )}

                    {results.benefits.eitc > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-eitc">
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium">Earned Income Tax Credit</p>
                            <p className="text-sm text-gray-500">Annual tax credit</p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">${results.benefits.eitc.toFixed(0)}/yr</p>
                      </div>
                    )}

                    {results.benefits.childTaxCredit > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-ctc">
                        <div className="flex items-center gap-3">
                          <Baby className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-medium">Child Tax Credit</p>
                            <p className="text-sm text-gray-500">Annual tax credit</p>
                          </div>
                        </div>
                        <p className="font-bold text-purple-600">${results.benefits.childTaxCredit.toFixed(0)}/yr</p>
                      </div>
                    )}

                    {results.benefits.ssi > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-ssi">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-orange-600" />
                          <div>
                            <p className="font-medium">SSI (Supplemental Security Income)</p>
                            <p className="text-sm text-gray-500">Monthly benefit</p>
                          </div>
                        </div>
                        <p className="font-bold text-orange-600">${results.benefits.ssi.toFixed(0)}/mo</p>
                      </div>
                    )}

                    {results.benefits.tanf > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid="benefit-tanf">
                        <div className="flex items-center gap-3">
                          <Home className="w-5 h-5 text-teal-600" />
                          <div>
                            <p className="font-medium">TANF (Cash Assistance)</p>
                            <p className="text-sm text-gray-500">Monthly benefit</p>
                          </div>
                        </div>
                        <p className="font-bold text-teal-600">${results.benefits.tanf.toFixed(0)}/mo</p>
                      </div>
                    )}

                    {eligibleCount === 0 && (
                      <Alert data-testid="alert-no-benefits">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Based on the information provided, you may not qualify for these benefits. However, eligibility can vary based on additional factors. Consider reaching out to a benefits navigator for personalized assistance.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Call to Action */}
                <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white" data-testid="card-cta">
                  <CardContent className="pt-6">
                    <h3 className="text-xl font-bold mb-2">Ready to Apply?</h3>
                    <p className="text-sm opacity-90 mb-4">
                      {savedSessionId 
                        ? "Your results are saved! Create an account or log in to keep them permanently and start your application."
                        : "Create a free account to save your results and start your application"
                      }
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="secondary" 
                        onClick={() => setLocation("/signup")}
                        data-testid="button-signup"
                        className="flex-1"
                      >
                        Create Free Account
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => claimMutation.mutate()}
                        disabled={claimMutation.isPending || !savedSessionId}
                        data-testid="button-save-to-account"
                        className="flex-1 bg-white/10 hover:bg-white/20 border-white/30"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {claimMutation.isPending ? "Saving..." : "I Have an Account"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <Alert className="mt-8" data-testid="alert-disclaimer">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Disclaimer:</strong> This is an estimate only. Actual eligibility and benefit amounts may vary. This tool is provided by the Maryland Benefits Navigator System to help you understand potential benefits. For official determinations, please apply through the appropriate benefit programs or consult with a certified benefits navigator.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

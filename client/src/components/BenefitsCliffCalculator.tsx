import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Users, Home, Zap, Heart, Calculator } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const cliffFormSchema = z.object({
  currentIncome: z.coerce.number().nonnegative().max(999999),
  proposedIncome: z.coerce.number().nonnegative().max(999999),
  householdSize: z.coerce.number().int().positive().max(20),
  adultCount: z.coerce.number().int().positive().max(20).optional().default(1),
  // Optional household details - use string schema with transform to preserve undefined
  unearnedIncome: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
  householdAssets: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
  rentOrMortgage: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
  utilityCosts: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
  medicalExpenses: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
  childcareExpenses: z.string().optional().transform(val => val === '' || val === undefined ? undefined : Number(val)),
});

type CliffFormData = z.infer<typeof cliffFormSchema>;

interface CliffComparison {
  current: {
    annualIncome: number;
    monthlyIncome: number;
    netAnnualIncome: number;
    netMonthlyIncome: number;
    benefits: {
      snap: number;
      medicaid: boolean;
      eitc: number;
      childTaxCredit: number;
      ssi: number;
      tanf: number;
      ohep: number;
    };
  };
  proposed: {
    annualIncome: number;
    monthlyIncome: number;
    netAnnualIncome: number;
    netMonthlyIncome: number;
    benefits: {
      snap: number;
      medicaid: boolean;
      eitc: number;
      childTaxCredit: number;
      ssi: number;
      tanf: number;
      ohep: number;
    };
  };
  wageIncrease: number;
  wageIncreasePercent: number;
  benefitLoss: number;
  netIncomeChange: number;
  netIncomeChangePercent: number;
  isCliff: boolean;
  cliffSeverity: 'none' | 'minor' | 'moderate' | 'severe';
  programImpacts: Array<{
    program: string;
    currentMonthly: number;
    proposedMonthly: number;
    monthlyChange: number;
  }>;
  recommendations: string[];
  warnings: string[];
}

export function BenefitsCliffCalculator() {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<CliffComparison | null>(null);

  const form = useForm<CliffFormData>({
    resolver: zodResolver(cliffFormSchema),
    defaultValues: {
      currentIncome: 24000,
      proposedIncome: 30000,
      householdSize: 3,
      adultCount: 1,
    },
  });

  const onSubmit = async (data: CliffFormData) => {
    setIsCalculating(true);
    setResult(null);

    try {
      const response = await apiRequest("/api/benefits/cliff-calculator", {
        method: "POST",
        body: JSON.stringify(data),
      });

      const comparison = await response.json();
      setResult(comparison);

      if (comparison.isCliff) {
        toast({
          title: "⚠️ Benefit Cliff Detected",
          description: `This wage increase results in ${comparison.cliffSeverity} net income loss due to benefit reductions.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ No Cliff Detected",
          description: "This wage increase will improve your overall financial situation.",
        });
      }
    } catch (error) {
      toast({
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Unable to calculate cliff impact",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      none: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: TrendingUp },
      minor: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: TrendingDown },
      moderate: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: AlertTriangle },
      severe: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertTriangle },
    };
    const { color, icon: Icon } = variants[severity] || variants.none;
    return (
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-cliff-calculator">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Benefits Cliff Calculator
          </CardTitle>
          <CardDescription>
            Compare two income scenarios to see how wage changes affect your total resources (wages + benefits - taxes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Annual Income</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="100"
                          placeholder="24000"
                          data-testid="input-current-income"
                        />
                      </FormControl>
                      <FormDescription>Your current annual wages</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proposedIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proposed Annual Income</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="100"
                          placeholder="30000"
                          data-testid="input-proposed-income"
                        />
                      </FormControl>
                      <FormDescription>Potential new annual wages</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          min="1"
                          max="20"
                          placeholder="3"
                          data-testid="input-household-size"
                        />
                      </FormControl>
                      <FormDescription>Total people in household</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adultCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adults (18+)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          max="20"
                          placeholder="1"
                          data-testid="input-adult-count"
                        />
                      </FormControl>
                      <FormDescription>Number of adults</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <details className="border rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-sm">
                  Additional Household Details (Optional)
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="rentOrMortgage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent/Mortgage</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="1200" data-testid="input-rent" />
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
                        <FormLabel>Monthly Utilities</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="150" data-testid="input-utilities" />
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
                        <FormLabel>Monthly Medical Expenses</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="100" data-testid="input-medical" />
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
                        <FormLabel>Monthly Childcare</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="0" placeholder="400" data-testid="input-childcare" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </details>

              <Button 
                type="submit" 
                disabled={isCalculating} 
                className="w-full"
                data-testid="button-calculate"
              >
                {isCalculating ? "Calculating..." : "Calculate Impact"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Cliff Warning Alert */}
          {result.isCliff && (
            <Alert variant="destructive" data-testid="alert-cliff-detected">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>BENEFIT CLIFF DETECTED ({result.cliffSeverity.toUpperCase()})</strong>
                <p className="mt-2">
                  Despite a wage increase of {formatCurrency(result.wageIncrease)}/year (+{result.wageIncreasePercent.toFixed(1)}%), 
                  your net income will <strong>decrease</strong> by {formatCurrency(Math.abs(result.netIncomeChange))}/year 
                  ({Math.abs(result.netIncomeChangePercent).toFixed(1)}%) due to benefit reductions.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Side-by-Side Scenario Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Scenario */}
            <Card data-testid="card-current-scenario">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Scenario</CardTitle>
                <CardDescription>Annual Income: {formatCurrency(result.current.annualIncome)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Wages (Monthly)</span>
                    <span className="font-medium" data-testid="text-current-wages">{formatCurrency(result.current.monthlyIncome)}</span>
                  </div>
                  {result.current.benefits.snap > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>SNAP</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.current.benefits.snap)}</span>
                    </div>
                  )}
                  {result.current.benefits.tanf > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>TANF</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.current.benefits.tanf)}</span>
                    </div>
                  )}
                  {result.current.benefits.ssi > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>SSI</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.current.benefits.ssi)}</span>
                    </div>
                  )}
                  {result.current.benefits.eitc > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>EITC (Monthly avg)</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.current.benefits.eitc / 12)}</span>
                    </div>
                  )}
                  {result.current.benefits.childTaxCredit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Child Tax Credit (Monthly avg)</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.current.benefits.childTaxCredit / 12)}</span>
                    </div>
                  )}
                  {result.current.benefits.medicaid && (
                    <div className="flex justify-between text-sm">
                      <span>Medicaid</span>
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">Eligible</Badge>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Net Monthly Income</span>
                  <span className="text-lg" data-testid="text-current-net">{formatCurrency(result.current.netMonthlyIncome)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Proposed Scenario */}
            <Card data-testid="card-proposed-scenario">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  Proposed Scenario
                  {getSeverityBadge(result.cliffSeverity)}
                </CardTitle>
                <CardDescription>Annual Income: {formatCurrency(result.proposed.annualIncome)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Wages (Monthly)</span>
                    <span className="font-medium" data-testid="text-proposed-wages">{formatCurrency(result.proposed.monthlyIncome)}</span>
                  </div>
                  {result.proposed.benefits.snap > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>SNAP</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.proposed.benefits.snap)}</span>
                    </div>
                  )}
                  {result.proposed.benefits.tanf > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>TANF</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.proposed.benefits.tanf)}</span>
                    </div>
                  )}
                  {result.proposed.benefits.ssi > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>SSI</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.proposed.benefits.ssi)}</span>
                    </div>
                  )}
                  {result.proposed.benefits.eitc > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>EITC (Monthly avg)</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.proposed.benefits.eitc / 12)}</span>
                    </div>
                  )}
                  {result.proposed.benefits.childTaxCredit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Child Tax Credit (Monthly avg)</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(result.proposed.benefits.childTaxCredit / 12)}</span>
                    </div>
                  )}
                  {result.proposed.benefits.medicaid && (
                    <div className="flex justify-between text-sm">
                      <span>Medicaid</span>
                      <Badge variant="outline" className="text-green-600 dark:text-green-400">Eligible</Badge>
                    </div>
                  )}
                  {result.current.benefits.medicaid && !result.proposed.benefits.medicaid && (
                    <div className="flex justify-between text-sm">
                      <span>Medicaid</span>
                      <Badge variant="outline" className="text-red-600 dark:text-red-400">Lost</Badge>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Net Monthly Income</span>
                  <span className={`text-lg ${result.isCliff ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} data-testid="text-proposed-net">
                    {formatCurrency(result.proposed.netMonthlyIncome)}
                  </span>
                </div>
                <div className={`text-sm ${result.netIncomeChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result.netIncomeChange >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(result.netIncomeChange))}/year 
                  ({result.netIncomeChange >= 0 ? '+' : ''}{result.netIncomeChangePercent.toFixed(1)}%)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Program-by-Program Impact Breakdown */}
          {result.programImpacts.length > 0 && (
            <Card data-testid="card-program-impacts">
              <CardHeader>
                <CardTitle className="text-lg">Program-by-Program Impact</CardTitle>
                <CardDescription>How each benefit changes with the wage increase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.programImpacts.map((impact, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">{impact.program}</span>
                      <div className="text-right">
                        <div className="text-sm">
                          {formatCurrency(impact.currentMonthly)} → {formatCurrency(impact.proposedMonthly)}
                        </div>
                        <div className={`text-xs ${impact.monthlyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {impact.monthlyChange >= 0 ? '+' : ''}{formatCurrency(impact.monthlyChange)}/month
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <Alert variant="destructive" data-testid="alert-warnings">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card data-testid="card-recommendations">
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

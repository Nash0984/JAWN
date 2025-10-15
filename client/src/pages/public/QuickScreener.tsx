import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ArrowRight, Info, Users, DollarSign, PiggyBank, Heart } from "lucide-react";

// Ultra-minimal screener schema - only 5-7 questions
const quickScreenerSchema = z.object({
  zipCode: z.string()
    .min(5, "ZIP code is required")
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code (e.g., 21201)"),
  householdSize: z.coerce.number()
    .min(1, "At least 1 person required")
    .max(20, "Please enter a valid household size"),
  monthlyIncome: z.coerce.number()
    .min(0, "Income cannot be negative"),
  hasSavingsOver2750: z.enum(["yes", "no"], {
    required_error: "Please select an option"
  }),
  hasElderlyOrDisabled: z.enum(["yes", "no"], {
    required_error: "Please select an option"
  })
});

type QuickScreenerFormData = z.infer<typeof quickScreenerSchema>;

export default function QuickScreener() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<"eligible" | "maybe" | null>(null);

  const form = useForm<QuickScreenerFormData>({
    resolver: zodResolver(quickScreenerSchema),
    defaultValues: {
      zipCode: "",
      householdSize: 1,
      monthlyIncome: 0,
      hasSavingsOver2750: undefined,
      hasElderlyOrDisabled: undefined
    }
  });

  const onSubmit = (data: QuickScreenerFormData) => {
    // Simple eligibility logic - index toward inclusivity (reduce false negatives)
    const monthlyIncomeLimit = data.householdSize * 2000; // Rough SNAP guideline
    const hasAssetIssue = data.hasSavingsOver2750 === "yes" && data.hasElderlyOrDisabled === "no";
    
    // Conservative eligibility check
    if (data.monthlyIncome <= monthlyIncomeLimit && !hasAssetIssue) {
      setResult("eligible");
    } else {
      setResult("maybe"); // Still show "may qualify" to reduce false negatives
    }
  };

  // Reset and start over
  const handleStartOver = () => {
    setResult(null);
    form.reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Quick Benefits Check
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
            Find out if you may qualify in under 2 minutes
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>No login required</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Completely anonymous</span>
            </div>
          </div>
        </div>

        {!result ? (
          <Card data-testid="card-quick-screener-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="w-6 h-6" />
                Quick Check (5 Questions)
              </CardTitle>
              <CardDescription className="text-base">
                This is a simple check to see if you might qualify for benefits. For detailed estimates, use our full screener.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* ZIP Code */}
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          1. What is your ZIP code?
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            placeholder="e.g., 21201"
                            {...field}
                            data-testid="input-zipcode"
                            className="h-11 text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Household Size */}
                  <FormField
                    control={form.control}
                    name="householdSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          2. How many people live in your household?
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            {...field}
                            data-testid="input-household-size"
                            className="h-11 text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Monthly Income */}
                  <FormField
                    control={form.control}
                    name="monthlyIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <DollarSign className="w-5 h-5" />
                          3. What is your total household monthly income?
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="$0"
                            {...field}
                            data-testid="input-monthly-income"
                            className="h-11 text-base"
                          />
                        </FormControl>
                        <p className="text-sm text-gray-500">Include all income sources (jobs, benefits, etc.)</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Savings/Assets */}
                  <FormField
                    control={form.control}
                    name="hasSavingsOver2750"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <PiggyBank className="w-5 h-5" />
                          4. Do you have savings or assets over $2,750?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[44px]">
                              <RadioGroupItem value="yes" id="savings-yes" data-testid="radio-savings-yes" />
                              <Label htmlFor="savings-yes" className="text-base cursor-pointer flex-1">
                                Yes
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[44px]">
                              <RadioGroupItem value="no" id="savings-no" data-testid="radio-savings-no" />
                              <Label htmlFor="savings-no" className="text-base cursor-pointer flex-1">
                                No
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Elderly or Disabled */}
                  <FormField
                    control={form.control}
                    name="hasElderlyOrDisabled"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base font-semibold flex items-center gap-2">
                          <Heart className="w-5 h-5" />
                          5. Is anyone in your household 60+ years old or disabled?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[44px]">
                              <RadioGroupItem value="yes" id="elderly-yes" data-testid="radio-elderly-yes" />
                              <Label htmlFor="elderly-yes" className="text-base cursor-pointer flex-1">
                                Yes
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg min-h-[44px]">
                              <RadioGroupItem value="no" id="elderly-no" data-testid="radio-elderly-no" />
                              <Label htmlFor="elderly-no" className="text-base cursor-pointer flex-1">
                                No
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button - 44px touch target */}
                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-full h-11 text-base font-semibold"
                    data-testid="button-check-eligibility"
                  >
                    Check Eligibility
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="card-eligibility-result" className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center gap-3 text-2xl text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-8 h-8" />
                {result === "eligible" ? "You May Qualify!" : "You Might Qualify!"}
              </CardTitle>
              <CardDescription className="text-base text-green-600 dark:text-green-500">
                {result === "eligible" 
                  ? "Based on your answers, you may be eligible for benefits."
                  : "You might be eligible for some benefits. We recommend taking the full screening."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <Alert>
                <Info className="h-5 w-5" />
                <AlertDescription className="text-base">
                  This is a quick check only. For accurate benefit estimates and to apply, please use our detailed screener or contact a navigator.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Next Steps:</h3>
                <div className="space-y-2 text-base">
                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Take the Full Screener</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get detailed benefit estimates including SNAP, Medicaid, and tax credits
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Talk to a Navigator (Optional)</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Get free help from a certified benefits navigator to apply
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  size="lg"
                  className="flex-1 h-11 text-base"
                  onClick={() => setLocation("/public/screener")}
                  data-testid="button-full-screener"
                >
                  Take Full Screener
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg"
                  className="flex-1 h-11 text-base"
                  onClick={handleStartOver}
                  data-testid="button-start-over"
                >
                  Start Over
                </Button>
              </div>

              <div className="text-center pt-4">
                <Button 
                  variant="link"
                  onClick={() => setLocation("/signup")}
                  data-testid="link-create-account"
                  className="text-base"
                >
                  Create an account to save your results
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Your privacy is protected. We don't collect personal information unless you create an account.
          </p>
        </div>
      </div>
    </div>
  );
}

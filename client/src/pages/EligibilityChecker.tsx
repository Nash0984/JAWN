import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Users, DollarSign, FileText, Info } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EligibilityResult {
  eligible: boolean;
  reason: string;
  estimatedBenefit?: number;
  nextSteps?: string[];
  requiredDocuments?: string[];
  appliedRules?: string[];
}

export default function EligibilityChecker() {
  const [step, setStep] = useState(1);
  const [householdSize, setHouseholdSize] = useState("1");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [hasEarnedIncome, setHasEarnedIncome] = useState<string>("no");
  const [hasSSI, setHasSSI] = useState<string>("no");
  const [hasTANF, setHasTANF] = useState<string>("no");
  const [result, setResult] = useState<EligibilityResult | null>(null);

  // Check eligibility mutation
  const checkEligibilityMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/eligibility/check", data);
      return response.json();
    },
    onSuccess: (data: EligibilityResult) => {
      setResult(data);
      setStep(3);
    },
  });

  const handleCheckEligibility = () => {
    checkEligibilityMutation.mutate({
      householdSize: parseInt(householdSize),
      monthlyIncome: parseFloat(monthlyIncome) * 100, // Convert to cents
      hasEarnedIncome: hasEarnedIncome === "yes",
      hasSSI: hasSSI === "yes",
      hasTANF: hasTANF === "yes",
    });
  };

  const resetForm = () => {
    setStep(1);
    setHouseholdSize("1");
    setMonthlyIncome("");
    setHasEarnedIncome("no");
    setHasSSI("no");
    setHasTANF("no");
    setResult(null);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          SNAP Eligibility Pre-Screener
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Answer a few quick questions to see if you may qualify for SNAP benefits in Maryland
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center ${step >= 1 ? 'text-primary' : 'text-gray-400 dark:text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium hidden sm:inline">Household</span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200 dark:bg-gray-700">
            <div className={`h-full ${step >= 2 ? 'bg-primary' : ''}`} style={{ width: step >= 2 ? '100%' : '0%' }} />
          </div>
          <div className={`flex items-center ${step >= 2 ? 'text-primary' : 'text-gray-400 dark:text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium hidden sm:inline">Income</span>
          </div>
          <div className="flex-1 h-1 mx-4 bg-gray-200 dark:bg-gray-700">
            <div className={`h-full ${step >= 3 ? 'bg-primary' : ''}`} style={{ width: step >= 3 ? '100%' : '0%' }} />
          </div>
          <div className={`flex items-center ${step >= 3 ? 'text-primary' : 'text-gray-400 dark:text-gray-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium hidden sm:inline">Results</span>
          </div>
        </div>
      </div>

      {/* Step 1: Household Information */}
      {step === 1 && (
        <Card data-testid="card-household-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Household Information
            </CardTitle>
            <CardDescription>
              Tell us about your household size
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="householdSize">How many people live in your household?</Label>
              <Input
                id="householdSize"
                type="number"
                min="1"
                max="20"
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
                placeholder="Enter number of people"
                data-testid="input-household-size"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Include yourself, spouse, children, and anyone you buy and prepare food with
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                A household is everyone who lives together and buys and prepares food together.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setStep(2)}
              disabled={!householdSize || parseInt(householdSize) < 1}
              className="w-full"
              data-testid="button-next-to-income"
            >
              Continue to Income Information
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Income Information */}
      {step === 2 && (
        <Card data-testid="card-income-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Income Information
            </CardTitle>
            <CardDescription>
              Tell us about your household's monthly income
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="monthlyIncome">What is your total monthly household income before taxes?</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Input
                  id="monthlyIncome"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  data-testid="input-monthly-income"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Include wages, self-employment, Social Security, child support, etc.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Do you or anyone in your household have earned income from work?</Label>
                <RadioGroup value={hasEarnedIncome} onValueChange={setHasEarnedIncome} data-testid="radio-earned-income">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="earned-yes" data-testid="radio-earned-yes" />
                    <Label htmlFor="earned-yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="earned-no" data-testid="radio-earned-no" />
                    <Label htmlFor="earned-no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Do you or anyone in your household receive SSI (Supplemental Security Income)?</Label>
                <RadioGroup value={hasSSI} onValueChange={setHasSSI} data-testid="radio-ssi">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="ssi-yes" data-testid="radio-ssi-yes" />
                    <Label htmlFor="ssi-yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ssi-no" data-testid="radio-ssi-no" />
                    <Label htmlFor="ssi-no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Do you or anyone in your household receive TANF (cash assistance)?</Label>
                <RadioGroup value={hasTANF} onValueChange={setHasTANF} data-testid="radio-tanf">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="tanf-yes" data-testid="radio-tanf-yes" />
                    <Label htmlFor="tanf-yes" className="font-normal">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="tanf-no" data-testid="radio-tanf-no" />
                    <Label htmlFor="tanf-no" className="font-normal">No</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                If you receive SSI or TANF, you may be automatically eligible for SNAP regardless of income.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
                data-testid="button-back-to-household"
              >
                Back
              </Button>
              <Button
                onClick={handleCheckEligibility}
                disabled={!monthlyIncome || parseFloat(monthlyIncome) < 0 || checkEligibilityMutation.isPending}
                className="flex-1"
                data-testid="button-check-eligibility"
              >
                {checkEligibilityMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Eligibility"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="space-y-6">
          <Card data-testid="card-eligibility-result">
            <CardHeader>
              <div className="flex items-center gap-3">
                {result.eligible ? (
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <CardTitle className="text-2xl">
                    {result.eligible ? "You May Be Eligible!" : "You May Not Be Eligible"}
                  </CardTitle>
                  <CardDescription>
                    Based on the information you provided
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className={result.eligible ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"}>
                <AlertDescription className={result.eligible ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}>
                  {result.reason}
                </AlertDescription>
              </Alert>

              {result.estimatedBenefit && result.estimatedBenefit > 0 && (
                <div className="bg-primary/10 dark:bg-primary/20 p-6 rounded-lg" data-testid="card-estimated-benefit">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Estimated Monthly Benefit</p>
                    <p className="text-4xl font-bold text-primary">
                      ${(result.estimatedBenefit / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      This is an estimate. Your actual benefit may vary.
                    </p>
                  </div>
                </div>
              )}

              {result.nextSteps && result.nextSteps.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Next Steps
                  </h3>
                  <ul className="space-y-2">
                    {result.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2" data-testid={`text-next-step-${index}`}>
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.requiredDocuments && result.requiredDocuments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents You May Need
                  </h3>
                  <div className="grid gap-2">
                    {result.requiredDocuments.map((doc, index) => (
                      <Badge key={index} variant="secondary" className="justify-start px-3 py-2" data-testid={`badge-document-${index}`}>
                        {doc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                  data-testid="button-start-over"
                >
                  Start Over
                </Button>
                {result.eligible && (
                  <Button
                    className="flex-1"
                    data-testid="button-apply-now"
                  >
                    Apply for SNAP
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This is a pre-screening tool and does not guarantee eligibility. 
              You must submit a complete application to receive benefits. Results are based on current Maryland SNAP policy rules.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VitaTaxPreviewProps {
  formData: any;
  sessionId?: string | null;
  className?: string;
}

interface TaxCalculationResult {
  federalTax: {
    totalIncome: number;
    scheduleC?: {
      grossBusinessIncome: number;
      businessExpenses: number;
      netProfit: number;
    };
    selfEmploymentTax?: {
      netEarnings: number;
      seTax: number;
      deductiblePortion: number;
    };
    adjustedGrossIncome: number;
    standardDeduction: number;
    taxableIncome: number;
    incomeTaxBeforeCredits: number;
    eitc: number;
    childTaxCredit: number;
    educationCredits?: {
      americanOpportunityCredit: number;
      aocRefundablePortion: number;
      lifetimeLearningCredit: number;
      totalEducationCredits: number;
    };
    totalCredits: number;
    totalFederalTax: number;
  };
  marylandTax: {
    marylandTaxableIncome: number;
    stateTax: number;
    countyTax: number;
    countyName: string;
    countyRate: number;
    marylandEITC: number;
    marylandCredits: number;
    totalMarylandTax: number;
  };
  totalTaxLiability: number;
  totalRefund: number;
  calculationBreakdown: string[];
  policyCitations: string[];
}

export function VitaTaxPreviewSidebar({ formData, sessionId, className }: VitaTaxPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [calculation, setCalculation] = useState<TaxCalculationResult | null>(null);
  const [lastCalculation, setLastCalculation] = useState<TaxCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showDetailedModal, setShowDetailedModal] = useState(false);

  const calculateTax = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare tax calculation input
      const taxInput = prepareTaxInput(formData);
      
      const response = await fetch('/api/vita-intake/calculate-tax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxInput),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate tax');
      }

      const result = await response.json();
      setCalculation(result);
      setLastCalculation(result); // Save as last valid calculation
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Tax calculation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
      // Keep last valid calculation visible
      if (lastCalculation) {
        setCalculation(lastCalculation);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced tax calculation on form data change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasMinimumRequiredData(formData)) {
        calculateTax();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [
    formData.hasW2Income,
    formData.w2JobCount,
    formData.hasSelfEmploymentIncome,
    formData.scheduleCExpenses,
    formData.hasRetirementIncome,
    formData.hasSocialSecurityIncome,
    formData.hasInterestIncome,
    formData.hasDividendIncome,
    formData.hasCapitalGains,
    formData.hasTuitionExpenses,
    formData.dependents,
    formData.maritalStatusDec31,
  ]);

  const prepareTaxInput = (data: any) => {
    // Determine filing status
    let filingStatus: "single" | "married_joint" | "married_separate" | "head_of_household" = "single";
    if (data.maritalStatusDec31 === "married") {
      filingStatus = "married_joint";
    } else if (data.dependents && data.dependents.length > 0) {
      filingStatus = "head_of_household";
    }

    // Calculate qualifying children (under 17 on Dec 31)
    const qualifyingChildren = (data.dependents || []).filter((dep: any) => {
      if (!dep.dateOfBirth) return false;
      const dob = new Date(dep.dateOfBirth);
      const dec31 = new Date(2024, 11, 31); // Assuming tax year 2024
      const age = dec31.getFullYear() - dob.getFullYear();
      return age < 17;
    }).length;

    return {
      filingStatus,
      taxYear: 2024,
      wages: (data.hasW2Income && data.w2JobCount > 0) ? 3000000 : 0, // Placeholder - needs actual W2 data
      otherIncome: (data.hasInterestIncome || data.hasDividendIncome) ? 50000 : 0, // Placeholder
      selfEmploymentIncome: data.hasSelfEmploymentIncome ? 2000000 : 0, // Placeholder
      businessExpenses: data.scheduleCExpenses || 0,
      numberOfQualifyingChildren: qualifyingChildren,
      dependents: (data.dependents || []).length,
      qualifiedEducationExpenses: data.hasTuitionExpenses ? 400000 : 0, // Placeholder
      numberOfStudents: data.hasTuitionExpenses ? 1 : 0,
      marylandCounty: "baltimore_city", // Should be determined from ZIP code
      marylandResidentMonths: 12,
    };
  };

  const hasMinimumRequiredData = (data: any): boolean => {
    // Need at least marital status to calculate
    return !!(data.maritalStatusDec31);
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getRefundColor = (amount: number): string => {
    if (amount > 0) return "text-green-600 dark:text-green-400";
    if (amount < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <Card className={cn("sticky top-4", className)} data-testid="tax-preview-sidebar">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Tax Preview</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={calculateTax}
            disabled={isLoading || !hasMinimumRequiredData(formData)}
            data-testid="button-recalculate"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <CardDescription className="text-xs">
          {lastUpdated ? (
            <span data-testid="text-last-updated">
              Updated {formatTimeSince(lastUpdated)} ago
            </span>
          ) : (
            "Enter income information to see estimate"
          )}
        </CardDescription>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-4">
        {error && (
          <Alert variant="destructive" className="py-2" data-testid="alert-calculation-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {error}
              {lastCalculation && " (showing last valid calculation)"}
            </AlertDescription>
          </Alert>
        )}

        {isLoading && !calculation && (
          <div className="space-y-3" data-testid="loading-skeleton">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {calculation && (
          <>
            {/* Total Refund/Owed - Prominent Display */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2" data-testid="total-refund-section">
              <div className="text-sm font-medium text-muted-foreground">
                {calculation.totalRefund > 0 ? "Estimated Refund" : "Estimated Owed"}
              </div>
              <div className={cn(
                "text-3xl font-bold flex items-center gap-2",
                getRefundColor(calculation.totalRefund)
              )}>
                {calculation.totalRefund > 0 ? (
                  <>
                    <TrendingUp className="h-6 w-6" />
                    {formatCurrency(calculation.totalRefund)}
                  </>
                ) : calculation.totalTaxLiability > 0 ? (
                  <>
                    <TrendingDown className="h-6 w-6" />
                    {formatCurrency(Math.abs(calculation.totalTaxLiability))}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6" />
                    $0
                  </>
                )}
              </div>
            </div>

            {/* Federal Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Federal Tax</div>
              
              {calculation.federalTax.eitc > 0 && (
                <div className="flex justify-between text-sm" data-testid="federal-eitc">
                  <span className="text-muted-foreground">EITC</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    +{formatCurrency(calculation.federalTax.eitc)}
                  </span>
                </div>
              )}

              {calculation.federalTax.childTaxCredit > 0 && (
                <div className="flex justify-between text-sm" data-testid="federal-ctc">
                  <span className="text-muted-foreground">Child Tax Credit</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    +{formatCurrency(calculation.federalTax.childTaxCredit)}
                  </span>
                </div>
              )}

              {calculation.federalTax.educationCredits && 
               calculation.federalTax.educationCredits.totalEducationCredits > 0 && (
                <div className="flex justify-between text-sm" data-testid="federal-education">
                  <span className="text-muted-foreground">Education Credits</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    +{formatCurrency(calculation.federalTax.educationCredits.totalEducationCredits)}
                  </span>
                </div>
              )}

              {calculation.federalTax.scheduleC && (
                <div className="flex justify-between text-sm" data-testid="federal-schedule-c">
                  <span className="text-muted-foreground">Business Income (Schedule C)</span>
                  <span className={cn(
                    "font-medium",
                    calculation.federalTax.scheduleC.netProfit >= 0 
                      ? "text-foreground" 
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {formatCurrency(calculation.federalTax.scheduleC.netProfit)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm pt-2 border-t" data-testid="federal-total">
                <span className="font-medium">Federal Tax</span>
                <span className={cn(
                  "font-semibold",
                  getRefundColor(-calculation.federalTax.totalFederalTax)
                )}>
                  {formatCurrency(Math.abs(calculation.federalTax.totalFederalTax))}
                </span>
              </div>
            </div>

            <Separator />

            {/* Maryland State Breakdown */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Maryland State Tax</div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">State Tax</span>
                <span className="font-medium">
                  {formatCurrency(calculation.marylandTax.stateTax)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  County Tax ({calculation.marylandTax.countyName.replace(/_/g, ' ')})
                </span>
                <span className="font-medium">
                  {formatCurrency(calculation.marylandTax.countyTax)}
                </span>
              </div>

              {calculation.marylandTax.marylandEITC > 0 && (
                <div className="flex justify-between text-sm" data-testid="maryland-eitc">
                  <span className="text-muted-foreground">MD EITC</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -{formatCurrency(calculation.marylandTax.marylandEITC)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm pt-2 border-t" data-testid="maryland-total">
                <span className="font-medium">Maryland Tax</span>
                <span className={cn(
                  "font-semibold",
                  getRefundColor(-calculation.marylandTax.totalMarylandTax)
                )}>
                  {formatCurrency(Math.abs(calculation.marylandTax.totalMarylandTax))}
                </span>
              </div>
            </div>

            {/* Calculation Breakdown Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={() => setShowBreakdown(!showBreakdown)}
              data-testid="button-toggle-breakdown"
            >
              <span className="text-xs">Calculation Steps</span>
              {showBreakdown ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showBreakdown && (
              <div className="bg-muted/30 rounded-md p-3 space-y-1" data-testid="calculation-breakdown">
                {calculation.calculationBreakdown.slice(0, 10).map((line, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground font-mono">
                    {line}
                  </div>
                ))}
                {calculation.calculationBreakdown.length > 10 && (
                  <div className="text-xs text-muted-foreground italic pt-1">
                    ... and {calculation.calculationBreakdown.length - 10} more steps
                  </div>
                )}
              </div>
            )}

            {/* View Detailed Modal */}
            <Dialog open={showDetailedModal} onOpenChange={setShowDetailedModal}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  data-testid="button-view-detailed"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Detailed Calculation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-detailed-calculation">
                <DialogHeader>
                  <DialogTitle>Detailed Tax Calculation</DialogTitle>
                  <DialogDescription>
                    Complete breakdown following IRS calculation methods
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-4">
                    {/* Full Breakdown */}
                    <div className="space-y-1">
                      {calculation.calculationBreakdown.map((line, idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "text-sm font-mono",
                            line.startsWith('===') ? "font-bold text-primary pt-2" :
                            line.startsWith('---') ? "font-semibold pt-1" :
                            line.startsWith('•') ? "pl-4 text-muted-foreground" :
                            "text-foreground"
                          )}
                        >
                          {line}
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Policy Citations */}
                    <div>
                      <h3 className="font-semibold mb-2">Policy References</h3>
                      <div className="space-y-1">
                        {calculation.policyCitations.map((citation, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            • {citation}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Disclaimer */}
            <Alert className="py-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                This is an estimate. Final tax may vary based on complete documentation and IRS review.
              </AlertDescription>
            </Alert>
          </>
        )}

        {!calculation && !isLoading && hasMinimumRequiredData(formData) && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Click Calculate to see tax estimate</p>
          </div>
        )}

        {!hasMinimumRequiredData(formData) && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Complete marital status to see estimate</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

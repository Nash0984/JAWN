import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TaxslayerReturn } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileText,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  BookOpen,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TaxSlayerComparisonProps {
  vitaSessionId: string;
  taxslayerReturnId?: string;
}

interface ComparisonRow {
  field: string;
  taxslayerValue: number;
  ourValue?: number;
  difference?: number;
  variancePercent?: number;
  status: "match" | "minor" | "major" | "unknown";
}

export function TaxSlayerComparison({ vitaSessionId, taxslayerReturnId }: TaxSlayerComparisonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Fetch TaxSlayer return data
  const { data: taxslayerData, isLoading: isLoadingTaxslayer } = useQuery<TaxslayerReturn>({
    queryKey: ["/api/taxslayer", vitaSessionId],
    enabled: !!vitaSessionId,
  });

  // Fetch our system's calculation (if available)
  const { data: ourCalculation, isLoading: isLoadingOurs } = useQuery({
    queryKey: ["/api/vita-intake", vitaSessionId],
    enabled: !!vitaSessionId,
  });

  // Generic export function
  const handleExport = async (endpoint: string, filename: string, type: 'pdf' | 'csv' = 'pdf') => {
    const id = taxslayerReturnId || taxslayerData?.id;
    if (!id) throw new Error("No TaxSlayer return ID");
    
    setIsExporting(true);
    
    try {
      const response = await fetch(`/api/taxslayer/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ourCalculation: ourCalculation ? {
            federalAGI: (ourCalculation as any).adjustedGrossIncome || 0,
            federalTax: (ourCalculation as any).calculatedFederalTax || 0,
            federalRefund: (ourCalculation as any).estimatedFederalRefund || 0,
            stateTax: (ourCalculation as any).calculatedStateTax || 0,
            stateRefund: (ourCalculation as any).estimatedStateRefund || 0,
            eitcAmount: (ourCalculation as any).estimatedEITC || 0,
            ctcAmount: (ourCalculation as any).estimatedCTC || 0,
            educationCredits: (ourCalculation as any).estimatedEducationCredits || 0,
          } : undefined,
        }),
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `${filename} has been downloaded`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate export. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export worksheet PDF
  const exportWorksheet = () => {
    handleExport(
      "export-pdf",
      `taxslayer-worksheet-${taxslayerData?.taxYear}-${taxslayerData?.id}.pdf`,
      'pdf'
    );
  };

  // Export checklist PDF
  const exportChecklist = () => {
    handleExport(
      "export-checklist",
      `taxslayer-checklist-${taxslayerData?.taxYear}-${taxslayerData?.id}.pdf`,
      'pdf'
    );
  };

  // Export variance report PDF
  const exportVarianceReport = () => {
    handleExport(
      "export-variance",
      `taxslayer-variance-${taxslayerData?.taxYear}-${taxslayerData?.id}.pdf`,
      'pdf'
    );
  };

  // Export field guide PDF
  const exportFieldGuide = () => {
    handleExport(
      "export-guide",
      `taxslayer-guide-${taxslayerData?.taxYear}-${taxslayerData?.id}.pdf`,
      'pdf'
    );
  };

  // Export CSV
  const exportCsv = () => {
    handleExport(
      "export-csv",
      `taxslayer-comparison-${taxslayerData?.taxYear}-${taxslayerData?.id}.csv`,
      'csv'
    );
  };

  if (isLoadingTaxslayer || isLoadingOurs) {
    return <div className="text-center p-8">Loading comparison data...</div>;
  }

  if (!taxslayerData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No TaxSlayer data found for this VITA session. Please import TaxSlayer data first.
        </AlertDescription>
      </Alert>
    );
  }

  // Extract our system's calculated values
  const ourAGI = ourCalculation ? (ourCalculation as any).adjustedGrossIncome : undefined;
  const ourTax = ourCalculation ? (ourCalculation as any).calculatedFederalTax : undefined;
  const ourRefund = ourCalculation ? (ourCalculation as any).estimatedFederalRefund : undefined;
  const ourEITC = ourCalculation ? (ourCalculation as any).estimatedEITC : undefined;
  const ourCTC = ourCalculation ? (ourCalculation as any).estimatedCTC : undefined;
  const ourEducationCredits = ourCalculation ? (ourCalculation as any).estimatedEducationCredits : undefined;
  const ourWithholding = ourCalculation ? (ourCalculation as any).federalTaxWithheld : undefined;
  const ourTaxableIncome = ourCalculation ? (ourCalculation as any).taxableIncome : undefined;

  // Build comparison rows
  const comparisonRows: ComparisonRow[] = [
    {
      field: "Federal AGI",
      taxslayerValue: taxslayerData.federalAGI || 0,
      ourValue: ourAGI,
      ...calculateVariance(taxslayerData.federalAGI || 0, ourAGI),
    },
    {
      field: "Federal Taxable Income",
      taxslayerValue: taxslayerData.federalTaxableIncome || 0,
      ourValue: ourTaxableIncome,
      ...calculateVariance(taxslayerData.federalTaxableIncome || 0, ourTaxableIncome),
    },
    {
      field: "Federal Tax",
      taxslayerValue: taxslayerData.federalTax || 0,
      ourValue: ourTax,
      ...calculateVariance(taxslayerData.federalTax || 0, ourTax),
    },
    {
      field: "Federal Withholding",
      taxslayerValue: taxslayerData.federalWithheld || 0,
      ourValue: ourWithholding,
      ...calculateVariance(taxslayerData.federalWithheld || 0, ourWithholding),
    },
    {
      field: "Federal Refund/Owed",
      taxslayerValue: taxslayerData.federalRefund || 0,
      ourValue: ourRefund,
      ...calculateVariance(taxslayerData.federalRefund || 0, ourRefund),
    },
    {
      field: "EITC",
      taxslayerValue: taxslayerData.eitcAmount || 0,
      ourValue: ourEITC,
      ...calculateVariance(taxslayerData.eitcAmount || 0, ourEITC),
    },
    {
      field: "CTC",
      taxslayerValue: taxslayerData.ctcAmount || 0,
      ourValue: ourCTC,
      ...calculateVariance(taxslayerData.ctcAmount || 0, ourCTC),
    },
    {
      field: "Education Credits",
      taxslayerValue: taxslayerData.educationCredits || 0,
      ourValue: ourEducationCredits,
      ...calculateVariance(taxslayerData.educationCredits || 0, ourEducationCredits),
    },
  ];

  const hasWarnings = taxslayerData.hasValidationWarnings;
  const warnings = (taxslayerData.validationWarnings as string[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-comparison-title">TaxSlayer vs Our System</h2>
          <p className="text-sm text-muted-foreground">
            Tax Year {taxslayerData.taxYear} • {formatFilingStatus(taxslayerData.filingStatus)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isExporting}
                data-testid="button-export-dropdown"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Options
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>PDF Exports</DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={exportWorksheet}
                data-testid="export-worksheet"
              >
                <FileText className="h-4 w-4 mr-2" />
                Entry Worksheet
                <span className="ml-auto text-xs text-muted-foreground">Main</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportChecklist}
                data-testid="export-checklist"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Line-by-Line Checklist
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportVarianceReport}
                data-testid="export-variance"
              >
                <FileBarChart className="h-4 w-4 mr-2" />
                Variance Report
                <span className="ml-auto text-xs text-muted-foreground">Supervisor</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={exportFieldGuide}
                data-testid="export-guide"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Field Mapping Guide
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Other Formats</DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={exportCsv}
                data-testid="export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasWarnings && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Validation Warnings Detected:</div>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning: string, idx: number) => (
                <li key={idx} className="text-sm">{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Line-by-Line Comparison</CardTitle>
          <CardDescription>
            Compare TaxSlayer calculations with our system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header row */}
            <div className="grid grid-cols-6 gap-4 pb-2 border-b font-semibold text-sm">
              <div className="col-span-2">Field</div>
              <div className="text-right">TaxSlayer</div>
              <div className="text-center">
                <ArrowRight className="h-4 w-4 mx-auto" />
              </div>
              <div className="text-right">Our System</div>
              <div className="text-right">Variance</div>
            </div>

            {/* Comparison rows */}
            {comparisonRows.map((row, idx) => (
              <ComparisonRow key={idx} {...row} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Income Documents Summary */}
      {((Array.isArray(taxslayerData.w2Forms) && taxslayerData.w2Forms.length > 0) || 
        (Array.isArray(taxslayerData.form1099s) && taxslayerData.form1099s.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Income Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.isArray(taxslayerData.w2Forms) && taxslayerData.w2Forms.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">W-2 Forms ({taxslayerData.w2Forms.length})</h4>
                  <div className="space-y-2">
                    {(taxslayerData.w2Forms as any[]).map((w2: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{w2.employer || "Unknown Employer"}</div>
                          {w2.ein && <div className="text-sm text-muted-foreground">EIN: {w2.ein}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(w2.wages)}</div>
                          <div className="text-sm text-muted-foreground">
                            Fed: {formatCurrency(w2.federalWithheld)} | State: {formatCurrency(w2.stateWithheld)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(taxslayerData.form1099s) && taxslayerData.form1099s.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">1099 Forms ({taxslayerData.form1099s.length})</h4>
                  <div className="space-y-2">
                    {(taxslayerData.form1099s as any[]).map((form1099: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{form1099.payer || "Unknown Payer"}</div>
                          <div className="text-sm text-muted-foreground">Type: 1099-{form1099.type}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(form1099.amount)}</div>
                          {form1099.federalWithheld > 0 && (
                            <div className="text-sm text-muted-foreground">
                              Withheld: {formatCurrency(form1099.federalWithheld)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule C Summary */}
      {taxslayerData.scheduleC && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule C - Self-Employment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Business Name:</span>
                <span>{(taxslayerData.scheduleC as any).businessName}</span>
              </div>
              {(taxslayerData.scheduleC as any).ein && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">EIN:</span>
                  <span>{(taxslayerData.scheduleC as any).ein}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Gross Receipts:</span>
                <span>{formatCurrency((taxslayerData.scheduleC as any).grossReceipts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Expenses:</span>
                <span>{formatCurrency((taxslayerData.scheduleC as any).expenses)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Net Profit:</span>
                <span className={(taxslayerData.scheduleC as any).netProfit < 0 ? "text-destructive" : ""}>
                  {formatCurrency((taxslayerData.scheduleC as any).netProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {taxslayerData.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{taxslayerData.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComparisonRow({ field, taxslayerValue, ourValue, difference, variancePercent, status }: ComparisonRow) {
  const getStatusIcon = () => {
    switch (status) {
      case "match":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "minor":
        return <Minus className="h-4 w-4 text-yellow-500" />;
      case "major":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "match":
        return "bg-green-50 dark:bg-green-950";
      case "minor":
        return "bg-yellow-50 dark:bg-yellow-950";
      case "major":
        return "bg-red-50 dark:bg-red-950";
      default:
        return "";
    }
  };

  const getVarianceIndicator = () => {
    if (!difference || difference === 0) return null;
    
    return difference > 0 
      ? <TrendingUp className="h-3 w-3 text-green-600" />
      : <TrendingDown className="h-3 w-3 text-red-600" />;
  };

  return (
    <div className={cn("grid grid-cols-6 gap-4 py-3 rounded-lg px-2", getStatusColor())} data-testid={`comparison-row-${field}`}>
      <div className="col-span-2 flex items-center gap-2">
        {getStatusIcon()}
        <span className="font-medium">{field}</span>
      </div>
      <div className="text-right font-mono">{formatCurrency(taxslayerValue)}</div>
      <div className="text-center">
        {ourValue !== undefined && <ArrowRight className="h-4 w-4 mx-auto" />}
      </div>
      <div className="text-right font-mono">
        {ourValue !== undefined ? formatCurrency(ourValue) : <span className="text-muted-foreground">N/A</span>}
      </div>
      <div className="text-right flex items-center justify-end gap-1">
        {difference !== undefined && difference !== 0 ? (
          <>
            {getVarianceIndicator()}
            <span className={cn("font-mono text-sm", status === "major" && "font-semibold text-destructive")}>
              {formatCurrency(Math.abs(difference))}
              {variancePercent !== undefined && variancePercent !== 0 && (
                <span className="ml-1 text-xs">({variancePercent.toFixed(1)}%)</span>
              )}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
    </div>
  );
}

// Helper functions
function calculateVariance(taxslayerValue: number, ourValue?: number) {
  if (ourValue === undefined) {
    return {
      difference: undefined,
      variancePercent: undefined,
      status: "unknown" as const,
    };
  }

  const difference = ourValue - taxslayerValue;
  const absDiff = Math.abs(difference);
  const variancePercent = taxslayerValue !== 0 ? (difference / taxslayerValue) * 100 : 0;

  let status: "match" | "minor" | "major" = "match";
  if (absDiff > 50) {
    status = "major";
  } else if (absDiff > 0) {
    status = "minor";
  }

  return {
    difference,
    variancePercent,
    status,
  };
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const absValue = Math.abs(value);
  const formatted = `$${absValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value < 0 ? `(${formatted})` : formatted;
}

function formatFilingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    single: "Single",
    married_joint: "Married Filing Jointly",
    married_separate: "Married Filing Separately",
    head_of_household: "Head of Household",
    qualifying_widow: "Qualifying Widow(er)",
  };
  return statusMap[status] || status;
}

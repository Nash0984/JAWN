import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileText,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Fetch TaxSlayer return data
  const { data: taxslayerData, isLoading: isLoadingTaxslayer } = useQuery({
    queryKey: ["/api/taxslayer", vitaSessionId],
    enabled: !!vitaSessionId,
  });

  // Fetch our system's calculation (if available)
  const { data: ourCalculation, isLoading: isLoadingOurs } = useQuery({
    queryKey: ["/api/vita-intake", vitaSessionId],
    enabled: !!vitaSessionId,
  });

  // Export PDF mutation
  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      const id = taxslayerReturnId || taxslayerData?.id;
      if (!id) throw new Error("No TaxSlayer return ID");
      
      const response = await fetch(`/api/taxslayer/${id}/export-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxslayer-return-${taxslayerData?.taxYear}-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "PDF Exported",
        description: "TaxSlayer return PDF has been downloaded",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    },
  });

  // Export CSV mutation
  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      const id = taxslayerReturnId || taxslayerData?.id;
      if (!id) throw new Error("No TaxSlayer return ID");
      
      const response = await fetch(`/api/taxslayer/${id}/export-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ourCalculation: ourCalculation ? {
            federalAGI: 0, // TODO: Extract from our calculation
            federalTax: 0,
            federalRefund: 0,
            eitcAmount: 0,
            ctcAmount: 0,
          } : undefined,
        }),
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxslayer-comparison-${taxslayerData?.taxYear}-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "CSV Exported",
        description: "Comparison data has been downloaded",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export CSV",
        variant: "destructive",
      });
    },
  });

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

  // Build comparison rows
  const comparisonRows: ComparisonRow[] = [
    {
      field: "Federal AGI",
      taxslayerValue: taxslayerData.federalAGI || 0,
      ourValue: undefined, // TODO: Extract from our calculation
      ...calculateVariance(taxslayerData.federalAGI || 0, undefined),
    },
    {
      field: "Federal Taxable Income",
      taxslayerValue: taxslayerData.federalTaxableIncome || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.federalTaxableIncome || 0, undefined),
    },
    {
      field: "Federal Tax",
      taxslayerValue: taxslayerData.federalTax || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.federalTax || 0, undefined),
    },
    {
      field: "Federal Withholding",
      taxslayerValue: taxslayerData.federalWithheld || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.federalWithheld || 0, undefined),
    },
    {
      field: "Federal Refund/Owed",
      taxslayerValue: taxslayerData.federalRefund || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.federalRefund || 0, undefined),
    },
    {
      field: "EITC",
      taxslayerValue: taxslayerData.eitcAmount || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.eitcAmount || 0, undefined),
    },
    {
      field: "CTC",
      taxslayerValue: taxslayerData.ctcAmount || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.ctcAmount || 0, undefined),
    },
    {
      field: "Education Credits",
      taxslayerValue: taxslayerData.educationCredits || 0,
      ourValue: undefined,
      ...calculateVariance(taxslayerData.educationCredits || 0, undefined),
    },
  ];

  const hasWarnings = taxslayerData.hasValidationWarnings;
  const warnings = taxslayerData.validationWarnings || [];

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPdfMutation.mutate()}
            disabled={exportPdfMutation.isPending}
            data-testid="button-export-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsvMutation.mutate()}
            disabled={exportCsvMutation.isPending}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
      {(taxslayerData.w2Forms?.length > 0 || taxslayerData.form1099s?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Income Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taxslayerData.w2Forms?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">W-2 Forms ({taxslayerData.w2Forms.length})</h4>
                  <div className="space-y-2">
                    {taxslayerData.w2Forms.map((w2: any, idx: number) => (
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

              {taxslayerData.form1099s?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">1099 Forms ({taxslayerData.form1099s.length})</h4>
                  <div className="space-y-2">
                    {taxslayerData.form1099s.map((form1099: any, idx: number) => (
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
                <span>{taxslayerData.scheduleC.businessName}</span>
              </div>
              {taxslayerData.scheduleC.ein && (
                <div className="flex items-center justify-between">
                  <span className="font-medium">EIN:</span>
                  <span>{taxslayerData.scheduleC.ein}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Gross Receipts:</span>
                <span>{formatCurrency(taxslayerData.scheduleC.grossReceipts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Expenses:</span>
                <span>{formatCurrency(taxslayerData.scheduleC.expenses)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Net Profit:</span>
                <span className={taxslayerData.scheduleC.netProfit < 0 ? "text-destructive" : ""}>
                  {formatCurrency(taxslayerData.scheduleC.netProfit)}
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

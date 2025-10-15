import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, 
  Save,
  AlertCircle,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CountyTaxRate {
  id: string;
  countyName: string;
  taxYear: number;
  minRate: number;
  maxRate: number;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
}

interface CountyTaxRatesResponse {
  success: boolean;
  taxYear: number;
  rates: CountyTaxRate[];
}

export default function CountyTaxRates() {
  const [taxYear, setTaxYear] = useState<string>("2025");
  const [editedRates, setEditedRates] = useState<Record<string, { minRate: number; maxRate: number }>>({});
  const { toast } = useToast();

  // Fetch county tax rates
  const { data, isLoading } = useQuery<CountyTaxRatesResponse>({
    queryKey: ['/api/admin/county-tax-rates', taxYear],
    queryFn: () => fetch(`/api/admin/county-tax-rates?year=${taxYear}`).then(res => res.json()),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const ratesToUpdate = data?.rates.map(rate => ({
        countyName: rate.countyName,
        minRate: editedRates[rate.countyName]?.minRate ?? rate.minRate,
        maxRate: editedRates[rate.countyName]?.maxRate ?? rate.maxRate,
      })) || [];

      return await apiRequest('POST', '/api/admin/county-tax-rates', {
        taxYear: parseInt(taxYear),
        rates: ratesToUpdate,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `County tax rates updated for ${taxYear}`,
      });
      setEditedRates({});
      queryClient.invalidateQueries({ queryKey: ['/api/admin/county-tax-rates'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to update county tax rates",
        variant: "destructive",
      });
    },
  });

  const handleRateChange = (countyName: string, field: 'minRate' | 'maxRate', value: string) => {
    const numValue = parseFloat(value) / 100; // Convert percentage to decimal
    if (!isNaN(numValue)) {
      setEditedRates(prev => ({
        ...prev,
        [countyName]: {
          ...prev[countyName],
          minRate: field === 'minRate' ? numValue : (prev[countyName]?.minRate ?? data?.rates.find(r => r.countyName === countyName)?.minRate ?? 0),
          maxRate: field === 'maxRate' ? numValue : (prev[countyName]?.maxRate ?? data?.rates.find(r => r.countyName === countyName)?.maxRate ?? 0),
        }
      }));
    }
  };

  const getCurrentRate = (countyName: string, field: 'minRate' | 'maxRate'): number => {
    if (editedRates[countyName]?.[field] !== undefined) {
      return editedRates[countyName][field];
    }
    return data?.rates.find(r => r.countyName === countyName)?.[field] ?? 0;
  };

  const hasUnsavedChanges = Object.keys(editedRates).length > 0;

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6" data-testid="page-county-tax-rates">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Maryland County Tax Rates</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Manage county tax rates for Maryland Form 502 calculations
        </p>
      </div>

      {/* Tax Year Selector and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tax Year & Actions
          </CardTitle>
          <CardDescription>
            Select tax year and update county tax rates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-tax-year">
                Tax Year
              </label>
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger data-testid="select-tax-year">
                  <SelectValue placeholder="Select tax year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024" data-testid="option-year-2024">2024</SelectItem>
                  <SelectItem value="2025" data-testid="option-year-2025">2025</SelectItem>
                  <SelectItem value="2026" data-testid="option-year-2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Save Changes</label>
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasUnsavedChanges}
                className="w-full"
                data-testid="button-save-rates"
              >
                <Save className={`h-4 w-4 mr-2 ${saveMutation.isPending ? 'animate-pulse' : ''}`} />
                {saveMutation.isPending ? 'Saving...' : hasUnsavedChanges ? 'Save All Changes' : 'No Changes'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Effective Date</label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                <Calendar className="h-4 w-4" />
                {data?.rates[0]?.effectiveDate ? 
                  new Date(data.rates[0].effectiveDate).toLocaleDateString() : 
                  'Not set'
                }
              </div>
            </div>
          </div>

          {hasUnsavedChanges && (
            <Alert data-testid="alert-unsaved-changes">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Click "Save All Changes" to update the rates.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* County Tax Rates Table */}
      {isLoading ? (
        <div className="text-center py-8" data-testid="text-loading">
          <p>Loading county tax rates...</p>
        </div>
      ) : !data || data.rates.length === 0 ? (
        <Alert data-testid="alert-no-rates">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No county tax rates found for {taxYear}. Rates need to be seeded in the database.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Maryland Counties ({data.rates.length})</CardTitle>
            <CardDescription>
              Enter rates as percentages (e.g., 2.25 for 2.25%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]" data-testid="header-county">County</TableHead>
                    <TableHead className="w-[25%]" data-testid="header-min-rate">Min Rate (%)</TableHead>
                    <TableHead className="w-[25%]" data-testid="header-max-rate">Max Rate (%)</TableHead>
                    <TableHead className="w-[10%]" data-testid="header-status">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rates.map((rate) => {
                    const currentMinRate = getCurrentRate(rate.countyName, 'minRate');
                    const currentMaxRate = getCurrentRate(rate.countyName, 'maxRate');
                    const isModified = editedRates[rate.countyName] !== undefined;

                    return (
                      <TableRow key={rate.id} data-testid={`row-county-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}>
                        <TableCell className="font-medium" data-testid={`text-county-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}>
                          {rate.countyName}
                          {isModified && (
                            <Badge variant="outline" className="ml-2" data-testid={`badge-modified-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}>
                              Modified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            value={(currentMinRate * 100).toFixed(2)}
                            onChange={(e) => handleRateChange(rate.countyName, 'minRate', e.target.value)}
                            className="w-24"
                            data-testid={`input-min-rate-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            value={(currentMaxRate * 100).toFixed(2)}
                            onChange={(e) => handleRateChange(rate.countyName, 'maxRate', e.target.value)}
                            className="w-24"
                            data-testid={`input-max-rate-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                          />
                        </TableCell>
                        <TableCell>
                          {currentMinRate > 0 && currentMaxRate > 0 ? (
                            <Badge variant="default" className="bg-green-500" data-testid={`badge-active-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}>
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-inactive-${rate.countyName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}>
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

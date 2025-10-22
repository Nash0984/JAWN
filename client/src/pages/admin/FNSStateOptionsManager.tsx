import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Filter,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";

// Backend field name 'MarylandStatus' preserved for API compatibility
interface MarylandStatus {
  id: string | null;
  isParticipating: boolean | null;
  adoptionDate: string | null;
  expirationDate: string | null;
  waiverType: string | null;
  affectedCounties: string[] | null;
  policyReference: string | null;
  notes: string | null;
  dataSource: string | null;
  lastVerifiedAt: string | null;
}

interface StateOption {
  id: string;
  optionCode: string;
  optionName: string;
  category: string;
  description: string;
  statutoryCitation: string | null;
  regulatoryCitation: string | null;
  policyEngineVariable: string | null;
  eligibilityImpact: string | null;
  benefitImpact: string | null;
  sourceUrl: string | null;
  isActive: boolean;
  marylandStatus: MarylandStatus; // Backend field name preserved
}

export default function FNSStateOptionsManager() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [participationFilter, setParticipationFilter] = useState<string>("all");
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';

  // Build query params
  const queryParams = new URLSearchParams();
  if (categoryFilter !== "all") {
    queryParams.append("category", categoryFilter);
  }
  if (participationFilter !== "all") {
    queryParams.append("isParticipating", participationFilter);
  }

  const queryString = queryParams.toString();
  const apiUrl = `/api/fns-state-options${queryString ? `?${queryString}` : ''}`;

  // Fetch state options
  const { data: options, isLoading } = useQuery<StateOption[]>({
    queryKey: ['/api/fns-state-options', categoryFilter, participationFilter],
    queryFn: () => fetch(apiUrl).then(res => res.json()),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/policy-sources/fns-state-options');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "FNS State Options synced successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fns-state-options'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync FNS State Options",
        variant: "destructive",
      });
    },
  });

  const categories = ["all", "Eligibility", "Benefits", "Work Requirements", "Administrative"];

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6" data-testid="page-fns-state-options">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">FNS State Options Manager</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Manage SNAP state options and waivers for {stateName}
        </p>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-category-filter">
                Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-participation-filter">
                Participation Status
              </label>
              <Select value={participationFilter} onValueChange={setParticipationFilter}>
                <SelectTrigger data-testid="select-participation-filter">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-participation-all">All</SelectItem>
                  <SelectItem value="true" data-testid="option-participation-true">Participating</SelectItem>
                  <SelectItem value="false" data-testid="option-participation-false">Not Participating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="w-full"
                data-testid="button-sync-options"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync from FNS Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Options Grid */}
      {isLoading ? (
        <div className="text-center py-8" data-testid="text-loading">
          <p>Loading state options...</p>
        </div>
      ) : !options || options.length === 0 ? (
        <Alert data-testid="alert-no-options">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No state options found. Click "Sync from FNS Report" to load the latest options.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const isParticipating = option.marylandStatus?.isParticipating ?? false;
            
            return (
              <Card key={option.id} data-testid={`card-option-${option.optionCode}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg" data-testid={`text-option-name-${option.optionCode}`}>
                        {option.optionName}
                      </CardTitle>
                      <CardDescription data-testid={`text-option-code-${option.optionCode}`}>
                        {option.optionCode}
                      </CardDescription>
                    </div>
                    {isParticipating ? (
                      <Badge 
                        variant="default" 
                        className="bg-green-500 hover:bg-green-600"
                        data-testid={`badge-participating-${option.optionCode}`}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Participating
                      </Badge>
                    ) : (
                      <Badge 
                        variant="secondary" 
                        className="bg-gray-400 hover:bg-gray-500"
                        data-testid={`badge-not-participating-${option.optionCode}`}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Participating
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Category</p>
                    <Badge variant="outline" data-testid={`text-category-${option.optionCode}`}>
                      {option.category}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-description-${option.optionCode}`}>
                      {option.description}
                    </p>
                  </div>

                  {option.marylandStatus?.adoptionDate && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Adoption Date</p>
                      <p className="text-sm" data-testid={`text-adoption-date-${option.optionCode}`}>
                        {new Date(option.marylandStatus.adoptionDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {option.marylandStatus?.waiverType && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Waiver Type</p>
                      <p className="text-sm" data-testid={`text-waiver-type-${option.optionCode}`}>
                        {option.marylandStatus.waiverType}
                      </p>
                    </div>
                  )}

                  {option.eligibilityImpact && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Eligibility Impact</p>
                      <p className="text-sm" data-testid={`text-eligibility-impact-${option.optionCode}`}>
                        {option.eligibilityImpact}
                      </p>
                    </div>
                  )}

                  {option.benefitImpact && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Benefit Impact</p>
                      <p className="text-sm" data-testid={`text-benefit-impact-${option.optionCode}`}>
                        {option.benefitImpact}
                      </p>
                    </div>
                  )}

                  {(option.statutoryCitation || option.regulatoryCitation) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Citations</p>
                      <div className="text-xs space-y-1">
                        {option.statutoryCitation && (
                          <p data-testid={`text-statutory-citation-${option.optionCode}`}>
                            <strong>Statutory:</strong> {option.statutoryCitation}
                          </p>
                        )}
                        {option.regulatoryCitation && (
                          <p data-testid={`text-regulatory-citation-${option.optionCode}`}>
                            <strong>Regulatory:</strong> {option.regulatoryCitation}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {option.marylandStatus?.dataSource && (
                    <div>
                      <p className="text-xs text-muted-foreground" data-testid={`text-data-source-${option.optionCode}`}>
                        Source: {option.marylandStatus.dataSource}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

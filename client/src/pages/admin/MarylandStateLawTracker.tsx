import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  RefreshCw, 
  FileText, 
  Calendar, 
  Users, 
  Filter,
  ExternalLink,
  Search,
  AlertCircle,
  Building2
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenant } from "@/contexts/TenantContext";

type StateBill = {
  id: string;
  billNumber: string;
  session: string;
  billType: string;
  title: string;
  synopsis: string | null;
  status: string;
  introducedDate: string | null;
  crossFiledWith: string | null;
  sponsors: any;
  committees: any;
  relatedPrograms: string[] | null;
  sourceUrl: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

type StateBillsResponse = {
  success: boolean;
  total: number;
  bills: StateBill[];
};

export default function StateLawTracker() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const stateCode = stateConfig?.stateCode || 'MD';
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("2025RS");
  const [billTypeFilter, setBillTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Build API URL with filters (backend uses maryland-bills endpoint for backward compatibility)
  const apiUrl = `/api/legislative/maryland-bills?${new URLSearchParams({
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(sessionFilter && { session: sessionFilter }),
    ...(billTypeFilter !== "all" && { billType: billTypeFilter }),
    limit: "100"
  }).toString()}`;

  // Fetch state legislature bills (backend uses maryland-bills endpoint for backward compatibility)
  const { data, isLoading } = useQuery<StateBillsResponse>({
    queryKey: ['/api/legislative/maryland-bills', statusFilter, sessionFilter, billTypeFilter],
    queryFn: () => fetch(apiUrl).then(res => res.json()),
  });

  // Extract bills array from wrapped response
  const bills = data?.bills ?? [];

  // Scrape mutation for state legislature (backend uses maryland-scrape endpoint for backward compatibility)
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/legislative/maryland-scrape', {
        session: sessionFilter
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${stateName} bills scraped successfully from state legislature website`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/legislative/maryland-bills'] });
    },
    onError: (error: any) => {
      toast({
        title: "Scrape Failed",
        description: error.message || `Failed to scrape ${stateName} bills`,
        variant: "destructive",
      });
    },
  });

  // Filter bills by search term
  const filteredBills = bills.filter(bill => 
    searchTerm === "" || 
    bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "enacted": return "bg-green-500";
      case "passed_second": return "bg-blue-500";
      case "passed_first": return "bg-indigo-500";
      case "committee": return "bg-yellow-500";
      case "prefiled": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getBillTypeLabel = (billType: string) => {
    const types: Record<string, string> = {
      'HB': 'House Bill',
      'SB': 'Senate Bill',
      'HJ': 'House Joint Resolution',
      'SJ': 'Senate Joint Resolution'
    };
    return types[billType] || billType;
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6" data-testid="page-state-law-tracker">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{stateName} State Law Tracker</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Track {stateName} state legislature legislation affecting SNAP, Medicaid, TANF, and other state benefit programs
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
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-session-filter">
                Legislative Session
              </label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger data-testid="select-session-filter">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025RS" data-testid="option-session-2025rs">2025 Regular Session</SelectItem>
                  <SelectItem value="2024RS" data-testid="option-session-2024rs">2024 Regular Session</SelectItem>
                  <SelectItem value="2023RS" data-testid="option-session-2023rs">2023 Regular Session</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-bill-type-filter">
                Bill Type
              </label>
              <Select value={billTypeFilter} onValueChange={setBillTypeFilter}>
                <SelectTrigger data-testid="select-bill-type-filter">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-bill-type-all">All</SelectItem>
                  <SelectItem value="HB" data-testid="option-bill-type-hb">House Bill</SelectItem>
                  <SelectItem value="SB" data-testid="option-bill-type-sb">Senate Bill</SelectItem>
                  <SelectItem value="HJ" data-testid="option-bill-type-hj">House Joint</SelectItem>
                  <SelectItem value="SJ" data-testid="option-bill-type-sj">Senate Joint</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-status-filter">
                Bill Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-status-all">All</SelectItem>
                  <SelectItem value="prefiled" data-testid="option-status-prefiled">Prefiled</SelectItem>
                  <SelectItem value="introduced" data-testid="option-status-introduced">Introduced</SelectItem>
                  <SelectItem value="committee" data-testid="option-status-committee">In Committee</SelectItem>
                  <SelectItem value="passed_first" data-testid="option-status-passed-first">Passed First Reading</SelectItem>
                  <SelectItem value="passed_second" data-testid="option-status-passed-second">Passed Second Reading</SelectItem>
                  <SelectItem value="enacted" data-testid="option-status-enacted">Enacted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-bills"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button 
                onClick={() => scrapeMutation.mutate()}
                disabled={scrapeMutation.isPending}
                className="w-full"
                data-testid="button-scrape-bills"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${scrapeMutation.isPending ? 'animate-spin' : ''}`} />
                {scrapeMutation.isPending ? 'Scraping...' : `Scrape ${stateCode} Bills`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      {isLoading ? (
        <div className="text-center py-12" data-testid="loading-bills">
          Loading {stateName} bills...
        </div>
      ) : !filteredBills || filteredBills.length === 0 ? (
        <EmptyState
          icon={Building2}
          iconColor="text-indigo-500"
          title={`No ${stateName} bills found`}
          description={`Click "Scrape ${stateCode} Bills" to load the latest legislation from the ${stateName} state legislature for the ${sessionFilter.replace('RS', ' Regular Session')}.`}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-bill-count">
              {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'} found
            </p>
          </div>

          <div className="grid gap-4">
            {filteredBills.map((bill) => (
              <Card key={bill.id} data-testid={`card-bill-${bill.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg" data-testid={`text-bill-number-${bill.id}`}>
                          {bill.billNumber}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {getBillTypeLabel(bill.billType)}
                        </Badge>
                        <Badge className={getStatusColor(bill.status)} data-testid={`badge-status-${bill.id}`}>
                          {getStatusLabel(bill.status)}
                        </Badge>
                        {bill.relatedPrograms && bill.relatedPrograms.length > 0 && (
                          <div className="flex gap-1">
                            {bill.relatedPrograms.slice(0, 3).map((program, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {program}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2" data-testid={`text-bill-title-${bill.id}`}>
                        {bill.title}
                      </CardDescription>
                    </div>
                    {bill.sourceUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        data-testid={`button-view-source-${bill.id}`}
                      >
                        <a href={bill.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bill.synopsis && (
                    <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-bill-synopsis-${bill.id}`}>
                      {bill.synopsis}
                    </p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Session</p>
                        <p className="text-muted-foreground">{bill.session}</p>
                      </div>
                    </div>

                    {bill.introducedDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Introduced</p>
                          <p className="text-muted-foreground">
                            {new Date(bill.introducedDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {bill.sponsors && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Sponsors</p>
                          <p className="text-muted-foreground">
                            {Array.isArray(bill.sponsors) ? bill.sponsors.length : 1}
                          </p>
                        </div>
                      </div>
                    )}

                    {bill.crossFiledWith && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Cross-Filed</p>
                          <p className="text-muted-foreground">{bill.crossFiledWith}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {bill.committees && Array.isArray(bill.committees) && bill.committees.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground">Committees:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {bill.committees.map((committee: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {typeof committee === 'string' ? committee : committee.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

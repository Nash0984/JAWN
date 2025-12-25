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
  AlertCircle
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type FederalBill = {
  id: string;
  billNumber: string;
  congress: number;
  billType: string;
  title: string;
  summary: string | null;
  status: string;
  introducedDate: string | null;
  latestActionDate: string | null;
  latestActionText: string | null;
  sponsors: any;
  committees: any;
  relatedPrograms: string[] | null;
  sourceUrl: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

type FederalBillsResponse = {
  success: boolean;
  total: number;
  bills: FederalBill[];
};

export default function FederalLawTracker() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [congressFilter, setCongressFilter] = useState("119");
  const [searchTerm, setSearchTerm] = useState("");

  // Build API URL with filters
  const apiUrl = `/api/legislative/federal-bills?${new URLSearchParams({
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(congressFilter && { congress: congressFilter }),
    limit: "100"
  }).toString()}`;

  // Fetch federal bills
  const { data, isLoading } = useQuery<FederalBillsResponse>({
    queryKey: ['/api/legislative/federal-bills', statusFilter, congressFilter],
    queryFn: () => fetch(apiUrl).then(res => res.json()),
  });

  // Extract bills array from wrapped response
  const bills = data?.bills ?? [];

  // Sync mutation for Congress.gov
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/legislative/congress-sync');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Federal bills synced successfully from Congress.gov",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/legislative/federal-bills'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync federal bills",
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
      case "passed_house": return "bg-blue-500";
      case "passed_senate": return "bg-indigo-500";
      case "vetoed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6" data-testid="page-federal-law-tracker">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Federal Law Tracker</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Track federal legislation affecting SNAP, Medicaid, TANF, and other benefit programs via Congress.gov
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
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-congress-filter">
                Congress
              </label>
              <Select value={congressFilter} onValueChange={setCongressFilter}>
                <SelectTrigger data-testid="select-congress-filter">
                  <SelectValue placeholder="Select congress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="119" data-testid="option-congress-119">119th Congress (2025-2026)</SelectItem>
                  <SelectItem value="118" data-testid="option-congress-118">118th Congress (2023-2024)</SelectItem>
                  <SelectItem value="117" data-testid="option-congress-117">117th Congress (2021-2022)</SelectItem>
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
                  <SelectItem value="introduced" data-testid="option-status-introduced">Introduced</SelectItem>
                  <SelectItem value="passed_house" data-testid="option-status-passed-house">Passed House</SelectItem>
                  <SelectItem value="passed_senate" data-testid="option-status-passed-senate">Passed Senate</SelectItem>
                  <SelectItem value="enacted" data-testid="option-status-enacted">Enacted</SelectItem>
                  <SelectItem value="vetoed" data-testid="option-status-vetoed">Vetoed</SelectItem>
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
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="w-full"
                data-testid="button-sync-bills"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync from Congress.gov'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      {isLoading ? (
        <div className="text-center py-12" data-testid="loading-bills">
          Loading federal bills...
        </div>
      ) : !filteredBills || filteredBills.length === 0 ? (
        <EmptyState
          icon={FileText}
          iconColor="text-blue-500"
          title="No federal bills found"
          description={`Click "Sync from Congress.gov" to load the latest bills tracking SNAP, Medicaid, TANF, and other benefit programs.`}
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
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg" data-testid={`text-bill-number-${bill.id}`}>
                          {bill.billNumber}
                        </CardTitle>
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
                  {bill.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-bill-summary-${bill.id}`}>
                      {bill.summary}
                    </p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

                    {bill.latestActionDate && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Latest Action</p>
                          <p className="text-muted-foreground">
                            {new Date(bill.latestActionDate).toLocaleDateString()}
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

                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Type</p>
                        <p className="text-muted-foreground uppercase">{bill.billType}</p>
                      </div>
                    </div>
                  </div>

                  {bill.latestActionText && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground">Latest Action:</p>
                      <p className="text-sm mt-1">{bill.latestActionText}</p>
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

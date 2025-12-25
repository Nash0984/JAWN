import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Users,
  Clock,
  TrendingUp,
  Shield,
  Calendar as CalendarIcon,
  Search,
  Filter,
  GitBranch,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  History,
  User,
  UserCheck,
  Database,
  Target
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeVariants, containerVariants } from "@/lib/animations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PolicyChange {
  id: string;
  changeTitle: string;
  changeType: string;
  changeCategory: string;
  severity: string;
  summary: string;
  technicalDescription: string;
  impactAnalysis: string;
  effectiveDate: string;
  status: string;
  publishedAt: string;
  createdAt: string;
  affectedRuleTables?: string[];
  ruleChangeIds?: string[];
  documentVersionId?: string;
  changesDiff?: any;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  createdBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdByUser?: { id: string; fullName: string; username: string };
  reviewedByUser?: { id: string; fullName: string; username: string };
}

interface PolicyChangeImpact {
  id: string;
  policyChangeId: string;
  impactType: string;
  impactSeverity: string;
  impactDescription: string;
  actionRequired: boolean;
  actionDescription: string;
  actionDeadline: string;
  acknowledged: boolean;
  resolved: boolean;
  affectedEntityType?: string;
  affectedEntityId?: string;
}

export function PolicyChanges() {
  const { user } = useAuth();
  const [selectedChange, setSelectedChange] = useState<PolicyChange | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Fetch policy changes
  const { data: changes = [], isLoading: changesLoading } = useQuery<PolicyChange[]>({
    queryKey: ['/api/policy-changes', statusFilter],
    enabled: !!user,
  });

  // Fetch user's impacts
  const { data: myImpacts = [], isLoading: impactsLoading } = useQuery<PolicyChangeImpact[]>({
    queryKey: ['/api/my-policy-impacts'],
    enabled: !!user,
  });

  // Acknowledge impact mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (impactId: string) => {
      const response = await apiRequest('PATCH', `/api/policy-change-impacts/${impactId}/acknowledge`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-policy-impacts'] });
    },
  });

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
    };
    return <Badge className={colors[severity as keyof typeof colors] || colors.medium} data-testid={`badge-severity-${severity}`}>{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
      reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    };
    return <Badge className={colors[status as keyof typeof colors] || colors.pending} data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const getImpactSeverityColor = (severity: string) => {
    const colors = {
      minimal: "text-blue-600 dark:text-blue-400",
      moderate: "text-yellow-600 dark:text-yellow-400",
      significant: "text-orange-600 dark:text-orange-400",
      major: "text-red-600 dark:text-red-400"
    };
    return colors[severity as keyof typeof colors] || colors.moderate;
  };

  // Filter changes based on all criteria
  const filteredChanges = changes.filter(change => {
    if (severityFilter !== "all" && change.severity !== severityFilter) return false;
    if (typeFilter !== "all" && change.changeType !== typeFilter) return false;
    if (searchQuery && !change.changeTitle.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !change.summary.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (dateRange.from && new Date(change.effectiveDate) < dateRange.from) return false;
    if (dateRange.to && new Date(change.effectiveDate) > dateRange.to) return false;
    return true;
  });

  const unresolvedImpacts = myImpacts.filter(i => !i.resolved);
  const requiresAction = unresolvedImpacts.filter(i => i.actionRequired);

  // Calculate impact stats for selected change
  const getImpactStats = (changeId: string) => {
    const impacts = myImpacts.filter(i => i.policyChangeId === changeId);
    return {
      total: impacts.length,
      resolved: impacts.filter(i => i.resolved).length,
      pending: impacts.filter(i => !i.resolved).length,
      actionRequired: impacts.filter(i => i.actionRequired && !i.resolved).length,
    };
  };

  // Render diff view
  const renderDiffView = (change: PolicyChange) => {
    if (!change.changesDiff && !change.beforeSnapshot && !change.afterSnapshot) {
      return (
        <Alert>
          <AlertDescription>No detailed diff information available for this change.</AlertDescription>
        </Alert>
      );
    }

    const diff = change.changesDiff || {};
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {change.beforeSnapshot && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500"></span>
                  Before Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-200 dark:border-red-800 overflow-x-auto" data-testid="diff-before-snapshot">
                  {JSON.stringify(change.beforeSnapshot, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
          
          {change.afterSnapshot && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500"></span>
                  After Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-800 overflow-x-auto" data-testid="diff-after-snapshot">
                  {JSON.stringify(change.afterSnapshot, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {Object.keys(diff).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Field Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2" data-testid="diff-field-changes">
                {Object.entries(diff).map(([field, values]: [string, any]) => (
                  <div key={field} className="border rounded-lg p-3 space-y-2">
                    <div className="font-medium text-sm">{field}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200 dark:border-red-800">
                        <div className="text-red-700 dark:text-red-400 font-medium mb-1">- Removed</div>
                        <div className="text-muted-foreground">{String(values.before || values.old || 'N/A')}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
                        <div className="text-green-700 dark:text-green-400 font-medium mb-1">+ Added</div>
                        <div className="text-muted-foreground">{String(values.after || values.new || 'N/A')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Find related changes for timeline
  const getRelatedChanges = (changeId: string) => {
    const currentChange = changes.find(c => c.id === changeId);
    if (!currentChange) return { previous: null, next: null };

    const sortedChanges = [...changes]
      .filter(c => c.status === 'published')
      .sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());

    const currentIndex = sortedChanges.findIndex(c => c.id === changeId);
    
    return {
      previous: currentIndex > 0 ? sortedChanges[currentIndex - 1] : null,
      next: currentIndex < sortedChanges.length - 1 ? sortedChanges[currentIndex + 1] : null,
    };
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Please sign in to view policy changes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div variants={fadeVariants} initial="hidden" animate="visible">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-policy-changes">
            Policy Change Monitor
          </h1>
          <p className="text-muted-foreground">
            Track policy updates, rule changes, and their impact on benefits
          </p>
        </div>

        {/* Summary Cards */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Changes Requiring Action
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="count-action-required">
                {requiresAction.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Review and respond
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Unresolved Impacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="count-unresolved">
                {unresolvedImpacts.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pending resolution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Recent Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="count-recent-changes">
                {changes.filter(c => c.status === 'published').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <Tabs defaultValue="all-changes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all-changes" data-testid="tab-all-changes">
              All Changes
            </TabsTrigger>
            <TabsTrigger value="my-impacts" data-testid="tab-my-impacts">
              My Impacts ({unresolvedImpacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all-changes">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Policy Changes</CardTitle>
                    <CardDescription>
                      Track all policy updates and rule changes
                    </CardDescription>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search changes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                        data-testid="input-search-changes"
                      />
                    </div>
                    
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="income_limit">Income Limit</SelectItem>
                        <SelectItem value="deduction">Deduction</SelectItem>
                        <SelectItem value="allotment">Allotment</SelectItem>
                        <SelectItem value="categorical">Categorical</SelectItem>
                        <SelectItem value="document_requirement">Document Requirement</SelectItem>
                        <SelectItem value="multiple">Multiple</SelectItem>
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[140px] justify-start" data-testid="button-date-filter">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, 'MMM d') : 'Date Range'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="range"
                          selected={{ from: dateRange.from, to: dateRange.to }}
                          onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>

                    {(severityFilter !== "all" || typeFilter !== "all" || searchQuery || dateRange.from) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSeverityFilter("all");
                          setTypeFilter("all");
                          setSearchQuery("");
                          setDateRange({});
                        }}
                        data-testid="button-clear-filters"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {changesLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredChanges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No policy changes found</p>
                    {(severityFilter !== "all" || typeFilter !== "all" || searchQuery) && (
                      <p className="text-sm mt-2">Try adjusting your filters</p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Change</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChanges.map((change) => (
                        <TableRow key={change.id} data-testid={`row-change-${change.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{change.changeTitle}</div>
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {change.summary}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{change.changeType.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell>{getSeverityBadge(change.severity)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(change.effectiveDate), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(change.status)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedChange(change)}
                                  data-testid={`button-view-${change.id}`}
                                >
                                  View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <div className="space-y-3">
                                    <Breadcrumb data-testid="breadcrumb-change-navigation">
                                      <BreadcrumbList>
                                        <BreadcrumbItem>
                                          <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); }}>
                                            Policy Changes
                                          </BreadcrumbLink>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                          <BreadcrumbPage>{change.changeCategory.replace(/_/g, ' ')}</BreadcrumbPage>
                                        </BreadcrumbItem>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                          <BreadcrumbPage>{change.changeType.replace(/_/g, ' ')}</BreadcrumbPage>
                                        </BreadcrumbItem>
                                      </BreadcrumbList>
                                    </Breadcrumb>
                                    
                                    <DialogTitle>{change.changeTitle}</DialogTitle>
                                    <DialogDescription className="flex items-center gap-4 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        Effective: {format(new Date(change.effectiveDate), 'MMMM d, yyyy')}
                                      </span>
                                      {getSeverityBadge(change.severity)}
                                      {getStatusBadge(change.status)}
                                    </DialogDescription>
                                  </div>
                                </DialogHeader>
                                
                                <Tabs defaultValue="details" className="mt-4">
                                  <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="details" data-testid="tab-change-details">Details</TabsTrigger>
                                    <TabsTrigger value="diff" data-testid="tab-change-diff">Diff View</TabsTrigger>
                                    <TabsTrigger value="impact" data-testid="tab-change-impact">Impact</TabsTrigger>
                                    <TabsTrigger value="timeline" data-testid="tab-change-timeline">Timeline</TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="details" className="space-y-4 mt-4">
                                    <div>
                                      <h4 className="font-semibold mb-2">Summary</h4>
                                      <p className="text-sm text-muted-foreground" data-testid="text-change-summary">{change.summary}</p>
                                    </div>
                                    
                                    {change.technicalDescription && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Technical Details</h4>
                                        <p className="text-sm text-muted-foreground" data-testid="text-change-technical">{change.technicalDescription}</p>
                                      </div>
                                    )}
                                    
                                    {change.impactAnalysis && (
                                      <div>
                                        <h4 className="font-semibold mb-2">Impact Analysis</h4>
                                        <p className="text-sm text-muted-foreground" data-testid="text-change-impact-analysis">{change.impactAnalysis}</p>
                                      </div>
                                    )}

                                    {change.affectedRuleTables && change.affectedRuleTables.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                          <Database className="h-4 w-4" />
                                          Affected Rule Tables
                                        </h4>
                                        <div className="flex flex-wrap gap-2" data-testid="list-affected-tables">
                                          {change.affectedRuleTables.map((table, idx) => (
                                            <Badge key={idx} variant="outline" className="font-mono text-xs">
                                              {table}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {change.ruleChangeIds && change.ruleChangeIds.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                          <GitBranch className="h-4 w-4" />
                                          Related Rule Changes
                                        </h4>
                                        <div className="space-y-1" data-testid="list-rule-changes">
                                          {change.ruleChangeIds.map((ruleId, idx) => (
                                            <div key={idx} className="text-sm text-muted-foreground font-mono">
                                              {ruleId}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {change.documentVersionId && (
                                      <div>
                                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                                          <FileText className="h-4 w-4" />
                                          Document Version
                                        </h4>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="gap-2"
                                          data-testid="button-view-document-version"
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                          View Document Version
                                        </Button>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                      {change.createdByUser && (
                                        <div>
                                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Created By
                                          </h4>
                                          <div className="text-sm" data-testid="text-created-by">
                                            <div className="font-medium">{change.createdByUser.fullName || change.createdByUser.username}</div>
                                            <div className="text-muted-foreground">
                                              {format(new Date(change.createdAt), 'MMM d, yyyy h:mm a')}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {change.reviewedByUser && change.reviewedAt && (
                                        <div>
                                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                                            <UserCheck className="h-4 w-4" />
                                            Reviewed By
                                          </h4>
                                          <div className="text-sm" data-testid="text-reviewed-by">
                                            <div className="font-medium">{change.reviewedByUser.fullName || change.reviewedByUser.username}</div>
                                            <div className="text-muted-foreground">
                                              {format(new Date(change.reviewedAt), 'MMM d, yyyy h:mm a')}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="diff" className="mt-4">
                                    {renderDiffView(change)}
                                  </TabsContent>

                                  <TabsContent value="impact" className="space-y-4 mt-4">
                                    {(() => {
                                      const stats = getImpactStats(change.id);
                                      const changeImpacts = myImpacts.filter(i => i.policyChangeId === change.id);
                                      
                                      return (
                                        <>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Card>
                                              <CardContent className="pt-6">
                                                <div className="text-2xl font-bold" data-testid="count-total-impacts">{stats.total}</div>
                                                <p className="text-xs text-muted-foreground">Total Impacts</p>
                                              </CardContent>
                                            </Card>
                                            <Card>
                                              <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-orange-600" data-testid="count-pending-impacts">{stats.pending}</div>
                                                <p className="text-xs text-muted-foreground">Pending</p>
                                              </CardContent>
                                            </Card>
                                            <Card>
                                              <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-green-600" data-testid="count-resolved-impacts">{stats.resolved}</div>
                                                <p className="text-xs text-muted-foreground">Resolved</p>
                                              </CardContent>
                                            </Card>
                                            <Card>
                                              <CardContent className="pt-6">
                                                <div className="text-2xl font-bold text-red-600" data-testid="count-action-impacts">{stats.actionRequired}</div>
                                                <p className="text-xs text-muted-foreground">Action Required</p>
                                              </CardContent>
                                            </Card>
                                          </div>

                                          {changeImpacts.length > 0 ? (
                                            <div className="space-y-3">
                                              <h4 className="font-semibold flex items-center gap-2">
                                                <Target className="h-4 w-4" />
                                                Impact Details
                                              </h4>
                                              {changeImpacts.map((impact) => (
                                                <Card key={impact.id} data-testid={`card-change-impact-${impact.id}`}>
                                                  <CardContent className="pt-4">
                                                    <div className="flex items-start justify-between">
                                                      <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                          <Badge variant="outline">{impact.impactType.replace(/_/g, ' ')}</Badge>
                                                          <span className={cn("text-sm font-medium", getImpactSeverityColor(impact.impactSeverity))}>
                                                            {impact.impactSeverity}
                                                          </span>
                                                          {impact.resolved && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{impact.impactDescription}</p>
                                                      </div>
                                                    </div>
                                                  </CardContent>
                                                </Card>
                                              ))}
                                            </div>
                                          ) : (
                                            <Alert>
                                              <AlertDescription>No impact records found for this change.</AlertDescription>
                                            </Alert>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </TabsContent>

                                  <TabsContent value="timeline" className="space-y-4 mt-4">
                                    {(() => {
                                      const related = getRelatedChanges(change.id);
                                      
                                      return (
                                        <>
                                          <div className="flex items-center justify-between">
                                            <h4 className="font-semibold flex items-center gap-2">
                                              <History className="h-4 w-4" />
                                              Version History Navigation
                                            </h4>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {related.previous ? (
                                              <Card className="cursor-pointer hover:bg-accent" onClick={() => setSelectedChange(related.previous!)}>
                                                <CardContent className="pt-4">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">Previous Change</span>
                                                  </div>
                                                  <div className="text-sm font-medium" data-testid="link-previous-change">{related.previous.changeTitle}</div>
                                                  <div className="text-xs text-muted-foreground mt-1">
                                                    {format(new Date(related.previous.effectiveDate), 'MMM d, yyyy')}
                                                  </div>
                                                </CardContent>
                                              </Card>
                                            ) : (
                                              <Card>
                                                <CardContent className="pt-4 text-center text-muted-foreground">
                                                  <div className="text-sm">No previous change</div>
                                                </CardContent>
                                              </Card>
                                            )}

                                            {related.next ? (
                                              <Card className="cursor-pointer hover:bg-accent" onClick={() => setSelectedChange(related.next!)}>
                                                <CardContent className="pt-4">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">Next Change</span>
                                                  </div>
                                                  <div className="text-sm font-medium" data-testid="link-next-change">{related.next.changeTitle}</div>
                                                  <div className="text-xs text-muted-foreground mt-1">
                                                    {format(new Date(related.next.effectiveDate), 'MMM d, yyyy')}
                                                  </div>
                                                </CardContent>
                                              </Card>
                                            ) : (
                                              <Card>
                                                <CardContent className="pt-4 text-center text-muted-foreground">
                                                  <div className="text-sm">No next change</div>
                                                </CardContent>
                                              </Card>
                                            )}
                                          </div>

                                          <div className="border-l-2 border-primary/20 pl-4 space-y-4 mt-6">
                                            <div className="relative">
                                              <div className="absolute -left-[1.3rem] top-2 h-3 w-3 rounded-full bg-primary"></div>
                                              <div className="space-y-1">
                                                <div className="font-medium">Current: {change.changeTitle}</div>
                                                <div className="text-sm text-muted-foreground">
                                                  {format(new Date(change.effectiveDate), 'MMMM d, yyyy')}
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                  {getSeverityBadge(change.severity)}
                                                  {getStatusBadge(change.status)}
                                                </div>
                                              </div>
                                            </div>

                                            {change.createdAt && (
                                              <div className="relative">
                                                <div className="absolute -left-[1.3rem] top-2 h-3 w-3 rounded-full bg-gray-300"></div>
                                                <div className="space-y-1">
                                                  <div className="text-sm font-medium">Created</div>
                                                  <div className="text-sm text-muted-foreground">
                                                    {format(new Date(change.createdAt), 'MMMM d, yyyy h:mm a')}
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {change.reviewedAt && (
                                              <div className="relative">
                                                <div className="absolute -left-[1.3rem] top-2 h-3 w-3 rounded-full bg-blue-300"></div>
                                                <div className="space-y-1">
                                                  <div className="text-sm font-medium">Reviewed</div>
                                                  <div className="text-sm text-muted-foreground">
                                                    {format(new Date(change.reviewedAt), 'MMMM d, yyyy h:mm a')}
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {change.publishedAt && (
                                              <div className="relative">
                                                <div className="absolute -left-[1.3rem] top-2 h-3 w-3 rounded-full bg-green-300"></div>
                                                <div className="space-y-1">
                                                  <div className="text-sm font-medium">Published</div>
                                                  <div className="text-sm text-muted-foreground">
                                                    {format(new Date(change.publishedAt), 'MMMM d, yyyy h:mm a')}
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-impacts">
            <Card>
              <CardHeader>
                <CardTitle>Changes Affecting You</CardTitle>
                <CardDescription>
                  Policy changes that may impact your benefits or cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                {impactsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : unresolvedImpacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No pending impacts - you're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unresolvedImpacts.map((impact) => (
                      <Card key={impact.id} data-testid={`card-impact-${impact.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {impact.actionRequired && (
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                )}
                                <span className="font-medium">{impact.impactType.replace(/_/g, ' ')}</span>
                                <Badge variant="outline" className={getImpactSeverityColor(impact.impactSeverity)}>
                                  {impact.impactSeverity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">
                                {impact.impactDescription}
                              </p>
                              {impact.actionRequired && impact.actionDescription && (
                                <Alert className="mb-3">
                                  <AlertDescription>
                                    <strong>Action Required:</strong> {impact.actionDescription}
                                    {impact.actionDeadline && (
                                      <span className="block mt-1 text-sm">
                                        Deadline: {format(new Date(impact.actionDeadline), 'MMM d, yyyy')}
                                      </span>
                                    )}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!impact.acknowledged && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => acknowledgeMutation.mutate(impact.id)}
                                disabled={acknowledgeMutation.isPending}
                                data-testid={`button-acknowledge-${impact.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

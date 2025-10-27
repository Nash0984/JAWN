import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, FileText, Filter, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistance } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  username: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

interface RuleChangeLog {
  id: string;
  ruleTable: string;
  ruleId: string;
  changeType: string;
  oldValues: any;
  newValues: any;
  changeReason: string | null;
  changedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  changerUsername: string;
  approverUsername: string | null;
}

export default function AuditLogs() {
  const [activeTab, setActiveTab] = useState("audit");
  
  // Audit logs filters
  const [auditAction, setAuditAction] = useState("");
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const auditPageSize = 50;

  // Rule change logs filters
  const [ruleTable, setRuleTable] = useState("");
  const [changeType, setChangeType] = useState("");
  const [ruleStartDate, setRuleStartDate] = useState("");
  const [ruleEndDate, setRuleEndDate] = useState("");
  const [rulePage, setRulePage] = useState(0);
  const rulePageSize = 50;

  // Disclosure state management
  const [expandedMetadata, setExpandedMetadata] = useState<Set<string>>(new Set());
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  const toggleMetadata = (id: string) => {
    const newExpanded = new Set(expandedMetadata);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMetadata(newExpanded);
  };

  const toggleChanges = (id: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChanges(newExpanded);
  };

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['/api/audit-logs', auditAction, auditEntityType, auditStartDate, auditEndDate, auditPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (auditAction) params.append('action', auditAction);
      if (auditEntityType) params.append('entityType', auditEntityType);
      if (auditStartDate) params.append('startDate', auditStartDate);
      if (auditEndDate) params.append('endDate', auditEndDate);
      params.append('limit', auditPageSize.toString());
      params.append('offset', (auditPage * auditPageSize).toString());
      
      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: activeTab === "audit"
  });

  // Fetch rule change logs
  const { data: ruleData, isLoading: ruleLoading } = useQuery({
    queryKey: ['/api/rule-change-logs', ruleTable, changeType, ruleStartDate, ruleEndDate, rulePage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ruleTable) params.append('ruleTable', ruleTable);
      if (changeType) params.append('changeType', changeType);
      if (ruleStartDate) params.append('startDate', ruleStartDate);
      if (ruleEndDate) params.append('endDate', ruleEndDate);
      params.append('limit', rulePageSize.toString());
      params.append('offset', (rulePage * rulePageSize).toString());
      
      const res = await fetch(`/api/rule-change-logs?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: activeTab === "rules"
  });

  const auditLogs = auditData?.logs || [];
  const auditTotal = auditData?.total || 0;
  const ruleLogs = ruleData?.logs || [];
  const ruleTotal = ruleData?.total || 0;

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      'API_REQUEST': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'ERROR': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'AUTH_LOGIN': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'AUTH_LOGOUT': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      'ADMIN_UPDATE': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'DOCUMENT_UPLOAD': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'BIAS_FLAG': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return colors[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const getChangeTypeBadge = (changeType: string) => {
    const colors: Record<string, string> = {
      'create': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'update': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'delete': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'approve': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[changeType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Audit Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              System activity tracking for compliance and transparency
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="audit" data-testid="tab-audit-logs">
              System Audit Logs
            </TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rule-changes">
              Rule Change Logs
            </TabsTrigger>
          </TabsList>

          {/* System Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Filter audit logs by action, entity type, and date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="audit-action">Action Type</Label>
                    <Select value={auditAction} onValueChange={setAuditAction}>
                      <SelectTrigger id="audit-action" data-testid="select-audit-action">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="API_REQUEST">API Request</SelectItem>
                        <SelectItem value="ERROR">Error</SelectItem>
                        <SelectItem value="AUTH_LOGIN">Login</SelectItem>
                        <SelectItem value="AUTH_LOGOUT">Logout</SelectItem>
                        <SelectItem value="ADMIN_UPDATE">Admin Update</SelectItem>
                        <SelectItem value="DOCUMENT_UPLOAD">Document Upload</SelectItem>
                        <SelectItem value="BIAS_FLAG">Bias Flag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audit-entity">Entity Type</Label>
                    <Select value={auditEntityType} onValueChange={setAuditEntityType}>
                      <SelectTrigger id="audit-entity" data-testid="select-entity-type">
                        <SelectValue placeholder="All entities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All entities</SelectItem>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="RULE">Rule</SelectItem>
                        <SelectItem value="DOCUMENT">Document</SelectItem>
                        <SelectItem value="REQUEST">Request</SelectItem>
                        <SelectItem value="search_query">Search Query</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audit-start-date">Start Date</Label>
                    <Input
                      id="audit-start-date"
                      type="date"
                      value={auditStartDate}
                      onChange={(e) => setAuditStartDate(e.target.value)}
                      data-testid="input-audit-start-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audit-end-date">End Date</Label>
                    <Input
                      id="audit-end-date"
                      type="date"
                      value={auditEndDate}
                      onChange={(e) => setAuditEndDate(e.target.value)}
                      data-testid="input-audit-end-date"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAuditAction("");
                      setAuditEntityType("");
                      setAuditStartDate("");
                      setAuditEndDate("");
                      setAuditPage(0);
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Log Entries</CardTitle>
                <CardDescription>
                  {auditTotal} total entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No audit logs found</p>
                    <p className="text-sm mt-2">System audit tracking will begin once activities occur</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table data-testid="table-audit-logs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs.map((log: AuditLog) => (
                            <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                              <TableCell className="font-mono text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span title={new Date(log.timestamp).toLocaleString()}>
                                    {formatDistance(new Date(log.timestamp), new Date(), { addSuffix: true })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getActionBadge(log.action)}>
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell>{log.username || 'System'}</TableCell>
                              <TableCell>
                                {log.entityType ? (
                                  <span className="text-sm">
                                    {log.entityType}
                                    {log.entityId && (
                                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                                        ({log.entityId.slice(0, 8)}...)
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {log.ipAddress || '-'}
                              </TableCell>
                              <TableCell>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="text-sm">
                                    <button
                                      type="button"
                                      onClick={() => toggleMetadata(log.id)}
                                      aria-expanded={expandedMetadata.has(log.id)}
                                      className="flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                                      data-testid={`button-view-metadata-${log.id}`}
                                    >
                                      {expandedMetadata.has(log.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      View metadata
                                    </button>
                                    {expandedMetadata.has(log.id) && (
                                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-w-md">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {auditPage * auditPageSize + 1} - {Math.min((auditPage + 1) * auditPageSize, auditTotal)} of {auditTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage(p => Math.max(0, p - 1))}
                          disabled={auditPage === 0}
                          data-testid="button-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage(p => p + 1)}
                          disabled={(auditPage + 1) * auditPageSize >= auditTotal}
                          data-testid="button-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rule Change Logs Tab */}
          <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>
                  Filter rule changes by table, change type, and date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rule-table">Rule Table</Label>
                    <Select value={ruleTable} onValueChange={setRuleTable}>
                      <SelectTrigger id="rule-table" data-testid="select-rule-table">
                        <SelectValue placeholder="All tables" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All tables</SelectItem>
                        <SelectItem value="snap_income_limits">Income Limits</SelectItem>
                        <SelectItem value="snap_deductions">Deductions</SelectItem>
                        <SelectItem value="snap_allotments">Allotments</SelectItem>
                        <SelectItem value="categorical_eligibility_rules">Categorical Eligibility</SelectItem>
                        <SelectItem value="document_requirement_rules">Document Requirements</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="change-type">Change Type</Label>
                    <Select value={changeType} onValueChange={setChangeType}>
                      <SelectTrigger id="change-type" data-testid="select-change-type">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="approve">Approve</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-start-date">Start Date</Label>
                    <Input
                      id="rule-start-date"
                      type="date"
                      value={ruleStartDate}
                      onChange={(e) => setRuleStartDate(e.target.value)}
                      data-testid="input-rule-start-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rule-end-date">End Date</Label>
                    <Input
                      id="rule-end-date"
                      type="date"
                      value={ruleEndDate}
                      onChange={(e) => setRuleEndDate(e.target.value)}
                      data-testid="input-rule-end-date"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRuleTable("");
                      setChangeType("");
                      setRuleStartDate("");
                      setRuleEndDate("");
                      setRulePage(0);
                    }}
                    data-testid="button-clear-rule-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rule Change History</CardTitle>
                <CardDescription>
                  {ruleTotal} total changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ruleLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : ruleLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No rule changes found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Rule Table</TableHead>
                            <TableHead>Change Type</TableHead>
                            <TableHead>Changed By</TableHead>
                            <TableHead>Approved By</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ruleLogs.map((log: RuleChangeLog) => (
                            <TableRow key={log.id} data-testid={`row-rule-${log.id}`}>
                              <TableCell className="font-mono text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span title={new Date(log.createdAt).toLocaleString()}>
                                    {formatDistance(new Date(log.createdAt), new Date(), { addSuffix: true })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.ruleTable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </TableCell>
                              <TableCell>
                                <Badge className={getChangeTypeBadge(log.changeType)}>
                                  {log.changeType}
                                </Badge>
                              </TableCell>
                              <TableCell>{log.changerUsername}</TableCell>
                              <TableCell>
                                {log.approverUsername ? (
                                  <span className="text-green-600 dark:text-green-400">
                                    {log.approverUsername}
                                  </span>
                                ) : (
                                  <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <button
                                    type="button"
                                    onClick={() => toggleChanges(log.id)}
                                    aria-expanded={expandedChanges.has(log.id)}
                                    className="flex items-center gap-1 cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
                                    data-testid={`button-view-changes-${log.id}`}
                                  >
                                    {expandedChanges.has(log.id) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    View changes
                                  </button>
                                  {expandedChanges.has(log.id) && (
                                    <div className="mt-2 space-y-2">
                                      {log.changeReason && (
                                        <div>
                                          <p className="font-semibold text-gray-700 dark:text-gray-300">Reason:</p>
                                          <p className="text-gray-600 dark:text-gray-400">{log.changeReason}</p>
                                        </div>
                                      )}
                                      {log.oldValues && (
                                        <div>
                                          <p className="font-semibold text-gray-700 dark:text-gray-300">Old Values:</p>
                                          <pre className="p-2 bg-red-50 dark:bg-red-950 rounded text-xs overflow-auto max-w-md">
                                            {JSON.stringify(log.oldValues, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-semibold text-gray-700 dark:text-gray-300">New Values:</p>
                                        <pre className="p-2 bg-green-50 dark:bg-green-950 rounded text-xs overflow-auto max-w-md">
                                          {JSON.stringify(log.newValues, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {rulePage * rulePageSize + 1} - {Math.min((rulePage + 1) * rulePageSize, ruleTotal)} of {ruleTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRulePage(p => Math.max(0, p - 1))}
                          disabled={rulePage === 0}
                          data-testid="button-rule-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRulePage(p => p + 1)}
                          disabled={(rulePage + 1) * rulePageSize >= ruleTotal}
                          data-testid="button-rule-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

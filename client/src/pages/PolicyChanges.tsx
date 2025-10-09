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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Users,
  Clock,
  TrendingUp,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeVariants, containerVariants } from "@/lib/animations";
import { format } from "date-fns";

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
}

export function PolicyChanges() {
  const { user } = useAuth();
  const [selectedChange, setSelectedChange] = useState<PolicyChange | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    return <Badge className={colors[severity as keyof typeof colors] || colors.medium}>{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
      reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
    };
    return <Badge className={colors[status as keyof typeof colors] || colors.pending}>{status}</Badge>;
  };

  const unresolvedImpacts = myImpacts.filter(i => !i.resolved);
  const requiresAction = unresolvedImpacts.filter(i => i.actionRequired);

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
                <CardTitle>Policy Changes</CardTitle>
                <CardDescription>
                  Track all policy updates and rule changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {changesLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : changes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No policy changes found</p>
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
                      {changes.map((change) => (
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
                              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{change.changeTitle}</DialogTitle>
                                  <DialogDescription>
                                    Effective: {format(new Date(change.effectiveDate), 'MMMM d, yyyy')}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-semibold mb-2">Summary</h4>
                                    <p className="text-sm text-muted-foreground">{change.summary}</p>
                                  </div>
                                  {change.technicalDescription && (
                                    <div>
                                      <h4 className="font-semibold mb-2">Technical Details</h4>
                                      <p className="text-sm text-muted-foreground">{change.technicalDescription}</p>
                                    </div>
                                  )}
                                  {change.impactAnalysis && (
                                    <div>
                                      <h4 className="font-semibold mb-2">Impact Analysis</h4>
                                      <p className="text-sm text-muted-foreground">{change.impactAnalysis}</p>
                                    </div>
                                  )}
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="text-sm font-medium">Severity: </span>
                                      {getSeverityBadge(change.severity)}
                                    </div>
                                    <div>
                                      <span className="text-sm font-medium">Status: </span>
                                      {getStatusBadge(change.status)}
                                    </div>
                                  </div>
                                </div>
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
                                <Badge variant="outline">{impact.impactSeverity}</Badge>
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

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, FileText } from 'lucide-react';

interface SessionData {
  id: string;
  navigatorId: string;
  sessionType: string;
  clientCaseId?: string;
  topicsDiscussed?: string[];
  documentsReceived?: any[];
  actionItems?: any[];
  notes?: string;
  outcomeStatus?: string;
  createdAt: string;
}

interface ClientData {
  id: string;
  clientName?: string;
  clientIdentifier?: string;
  householdSize?: number;
  estimatedIncome?: number;
  status?: string;
}

interface NavigatorInfo {
  id: string;
  fullName: string;
}

interface DataQualityDashboardProps {
  sessions: SessionData[];
  clients?: ClientData[];
  navigators?: NavigatorInfo[];
  timeframe?: 'week' | 'month' | 'quarter';
}

export function DataQualityDashboard({ 
  sessions = [], 
  clients = [], 
  navigators = [],
  timeframe = 'week' 
}: DataQualityDashboardProps) {
  
  const stats = useMemo(() => {
    // Calculate overall completeness
    const requiredSessionFields = ['sessionType', 'outcomeStatus', 'topicsDiscussed', 'notes'];
    const optionalFields = ['documentsReceived', 'actionItems'];
    
    let totalFieldsChecked = 0;
    let totalFieldsComplete = 0;
    
    sessions.forEach(session => {
      requiredSessionFields.forEach(field => {
        totalFieldsChecked++;
        const value = session[field as keyof SessionData];
        if (value && (typeof value !== 'object' || (Array.isArray(value) && value.length > 0))) {
          totalFieldsComplete++;
        }
      });
    });
    
    const overallCompleteness = sessions.length > 0 
      ? Math.round((totalFieldsComplete / totalFieldsChecked) * 100)
      : 0;
    
    // Find most common gaps
    const fieldGaps: Record<string, number> = {};
    sessions.forEach(session => {
      requiredSessionFields.forEach(field => {
        const value = session[field as keyof SessionData];
        if (!value || (Array.isArray(value) && value.length === 0)) {
          fieldGaps[field] = (fieldGaps[field] || 0) + 1;
        }
      });
    });
    
    const commonGaps = Object.entries(fieldGaps)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([field, count]) => ({
        field,
        count,
        percentage: Math.round((count / sessions.length) * 100)
      }));
    
    // Navigator performance
    const navigatorStats: Record<string, {
      sessionCount: number;
      completedFields: number;
      totalFields: number;
      avgNotesLength: number;
    }> = {};
    
    sessions.forEach(session => {
      if (!navigatorStats[session.navigatorId]) {
        navigatorStats[session.navigatorId] = {
          sessionCount: 0,
          completedFields: 0,
          totalFields: 0,
          avgNotesLength: 0
        };
      }
      
      const navStat = navigatorStats[session.navigatorId];
      navStat.sessionCount++;
      
      requiredSessionFields.forEach(field => {
        navStat.totalFields++;
        const value = session[field as keyof SessionData];
        if (value && (typeof value !== 'object' || (Array.isArray(value) && value.length > 0))) {
          navStat.completedFields++;
        }
      });
      
      if (session.notes) {
        navStat.avgNotesLength += session.notes.length;
      }
    });
    
    // Calculate averages
    Object.values(navigatorStats).forEach(stat => {
      stat.avgNotesLength = Math.round(stat.avgNotesLength / stat.sessionCount);
    });
    
    const navigatorPerformance = Object.entries(navigatorStats).map(([navId, stats]) => {
      const navigator = navigators.find(n => n.id === navId);
      return {
        navigatorId: navId,
        navigatorName: navigator?.fullName || 'Unknown',
        sessionCount: stats.sessionCount,
        completeness: Math.round((stats.completedFields / stats.totalFields) * 100),
        avgNotesLength: stats.avgNotesLength
      };
    }).sort((a, b) => b.completeness - a.completeness);
    
    return {
      overallCompleteness,
      totalSessions: sessions.length,
      commonGaps,
      navigatorPerformance
    };
  }, [sessions, navigators]);
  
  return (
    <div className="space-y-6" data-testid="data-quality-dashboard">
      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overallCompleteness}%</div>
            <Progress value={stats.overallCompleteness} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Across {stats.totalSessions} sessions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Navigators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {stats.navigatorPerformance.length}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This {timeframe}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {stats.totalSessions}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sessions logged
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="gaps" className="w-full">
        <TabsList>
          <TabsTrigger value="gaps">Common Gaps</TabsTrigger>
          <TabsTrigger value="navigators">Navigator Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Common Data Gaps</CardTitle>
              <CardDescription>
                Fields frequently missing across sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.commonGaps.length > 0 ? (
                <div className="space-y-4">
                  {stats.commonGaps.map((gap) => (
                    <div key={gap.field} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-medium capitalize">
                            {gap.field.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <Badge variant="secondary">
                          {gap.count} sessions ({gap.percentage}%)
                        </Badge>
                      </div>
                      <Progress value={gap.percentage} className="h-2" />
                    </div>
                  ))}
                  
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Tip:</strong> Focus training on these areas to improve data completeness and quality.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p>No significant data gaps detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="navigators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Navigator Performance</CardTitle>
              <CardDescription>
                Data completeness by team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.navigatorPerformance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Navigator</TableHead>
                      <TableHead className="text-center">Sessions</TableHead>
                      <TableHead className="text-center">Completeness</TableHead>
                      <TableHead className="text-center">Avg Notes Length</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.navigatorPerformance.map((nav) => (
                      <TableRow key={nav.navigatorId}>
                        <TableCell className="font-medium">
                          {nav.navigatorName}
                        </TableCell>
                        <TableCell className="text-center">
                          {nav.sessionCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge 
                              variant={nav.completeness >= 80 ? "default" : nav.completeness >= 60 ? "secondary" : "destructive"}
                            >
                              {nav.completeness}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            {nav.avgNotesLength} chars
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {nav.completeness >= 80 ? (
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2" />
                  <p>No navigator data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

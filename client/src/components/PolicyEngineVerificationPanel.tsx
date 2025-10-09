import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VerificationStatsDisplay, PolicyEngineVerificationBadge } from './PolicyEngineVerificationBadge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface BenefitProgram {
  id: string;
  code: string;
  name: string;
  programType: string;
  hasPolicyEngineValidation: boolean;
}

interface VerificationRecord {
  id: string;
  verificationType: string;
  isMatch: boolean;
  confidenceScore: number;
  variance: number | null;
  variancePercentage: number | null;
  createdAt: string;
  performedBy: string | null;
  sessionId: string | null;
  inputData: any;
  ourResult: any;
  policyEngineResult: any;
  errorDetails: string | null;
}

export function PolicyEngineVerificationPanel() {
  const [selectedProgram, setSelectedProgram] = useState<string>('MD_SNAP');
  
  // Fetch benefit programs
  const { data: programs } = useQuery<BenefitProgram[]>({
    queryKey: ['/api/benefit-programs'],
  });
  
  // Fetch verification stats for selected program
  const { data: stats, refetch: refetchStats, isLoading: statsLoading } = useQuery<{
    programCode: string;
    programName: string;
    totalVerifications: number;
    matchRate: number;
    averageConfidence: number;
    averageVariancePercent: number;
  }>({
    queryKey: ['/api/policyengine/verify/stats', selectedProgram],
    enabled: !!selectedProgram,
  });
  
  // Fetch verification history for selected program
  const { data: historyData, refetch: refetchHistory, isLoading: historyLoading } = useQuery<{
    programCode: string;
    programName: string;
    verifications: VerificationRecord[];
  }>({
    queryKey: ['/api/policyengine/verify/history', selectedProgram],
    enabled: !!selectedProgram,
  });
  
  const validationEnabledPrograms = programs?.filter(p => p.hasPolicyEngineValidation) || [];
  
  const handleRefresh = () => {
    refetchStats();
    refetchHistory();
  };
  
  return (
    <div className="space-y-6" data-testid="verification-panel">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PolicyEngine Verification System</CardTitle>
              <CardDescription>
                Independent verification of benefit calculations using PolicyEngine's third-party API
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Program</label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger data-testid="select-program">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validationEnabledPrograms.map(program => (
                  <SelectItem key={program.id} value={program.code}>
                    {program.name} ({program.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {stats && !statsLoading && (
            <VerificationStatsDisplay 
              stats={stats} 
              programName={stats.programName || selectedProgram}
            />
          )}
        </CardContent>
      </Card>
      
      {historyData && !historyLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Verification History</CardTitle>
            <CardDescription>
              {historyData.verifications.length} verification{historyData.verifications.length !== 1 ? 's' : ''} recorded for {historyData.programName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historyData.verifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No verifications recorded yet for this program
                </p>
              ) : (
                historyData.verifications.map((verification) => (
                  <VerificationHistoryItem 
                    key={verification.id} 
                    verification={verification}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VerificationHistoryItem({ verification }: { verification: VerificationRecord }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="border rounded-lg p-4"
      data-testid={`verification-item-${verification.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {verification.verificationType.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(verification.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          
          <PolicyEngineVerificationBadge
            isMatch={verification.isMatch}
            confidenceScore={verification.confidenceScore}
            variancePercentage={verification.variancePercentage}
          />
        </div>
      </div>
      
      <CollapsibleContent className="mt-4 space-y-3">
        {verification.errorDetails && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <p className="text-sm font-medium text-destructive mb-1">Error</p>
            <p className="text-xs text-destructive/80">{verification.errorDetails}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Our Result</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
              {JSON.stringify(verification.ourResult, null, 2)}
            </pre>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">PolicyEngine Result</p>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
              {verification.policyEngineResult 
                ? JSON.stringify(verification.policyEngineResult, null, 2)
                : 'N/A (verification failed)'}
            </pre>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium">Input Data</p>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32">
            {JSON.stringify(verification.inputData, null, 2)}
          </pre>
        </div>
        
        {verification.variance !== null && (
          <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-md">
            <span>Variance:</span>
            <span className="font-mono">${verification.variance.toFixed(2)}</span>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

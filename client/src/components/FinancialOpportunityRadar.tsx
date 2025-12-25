import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Lightbulb,
  DollarSign,
  Users,
  Activity
} from 'lucide-react';
import { useEligibilityRadar, type HouseholdData } from '@/hooks/useEligibilityRadar';
import { motion, AnimatePresence } from 'framer-motion';

interface FinancialOpportunityRadarProps {
  householdData: HouseholdData;
  className?: string;
}

/**
 * Financial Opportunity Radar - Persistent sidebar widget
 * Shows real-time cross-program eligibility as household data changes
 */
export function FinancialOpportunityRadar({ 
  householdData, 
  className = '' 
}: FinancialOpportunityRadarProps) {
  const { 
    programs, 
    alerts, 
    summary, 
    isCalculating, 
    error, 
    lastUpdated,
    calculate 
  } = useEligibilityRadar(300);
  
  // Recalculate when any relevant household data field changes
  useEffect(() => {
    if (householdData) {
      calculate(householdData);
    }
  }, [
    householdData.adults,
    householdData.children,
    householdData.elderlyOrDisabled,
    householdData.employmentIncome,
    householdData.unearnedIncome,
    householdData.selfEmploymentIncome,
    householdData.householdAssets,
    householdData.rentOrMortgage,
    householdData.utilityCosts,
    householdData.medicalExpenses,
    householdData.childcareExpenses,
    householdData.filingStatus,
    householdData.wageWithholding,
    householdData.stateCode,
    householdData.year,
    calculate
  ]);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'eligible':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" data-testid="icon-eligible" />;
      case 'ineligible':
        return <XCircle className="h-5 w-5 text-gray-400 dark:text-gray-600" data-testid="icon-ineligible" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" data-testid="icon-needs-info" />;
    }
  };
  
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };
  
  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const getChangeIndicator = (change: number | string | undefined, changePercent?: number) => {
    if (!change || change === 0 || change === 'unchanged') return null;
    
    // Handle string indicators
    if (typeof change === 'string') {
      if (change === 'new') {
        return (
          <Badge variant="default" className="ml-2 text-xs bg-green-600 dark:bg-green-500" data-testid="badge-new">
            New
          </Badge>
        );
      }
      if (change === 'changed') {
        return (
          <Badge variant="outline" className="ml-2 text-xs" data-testid="badge-changed">
            Changed
          </Badge>
        );
      }
      return null;
    }
    
    // Handle numeric changes
    const isIncrease = change > 0;
    
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`ml-2 flex items-center text-xs ${
          isIncrease ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}
        data-testid={isIncrease ? 'indicator-increase' : 'indicator-decrease'}
      >
        {isIncrease ? (
          <TrendingUp className="h-3 w-3 mr-1" />
        ) : (
          <TrendingDown className="h-3 w-3 mr-1" />
        )}
        {changePercent ? `${Math.abs(changePercent)}%` : formatCurrency(Math.abs(change))}
      </motion.div>
    );
  };
  
  return (
    <div className={`financial-opportunity-radar ${className}`}>
      <Card className="border-2 border-primary/20 bg-background dark:bg-gray-950">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Financial Opportunity Radar</span>
            </div>
            {isCalculating && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full"
                data-testid="loading-spinner"
              />
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          {summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-lg"
            >
              <div className="space-y-1" data-testid="summary-monthly">
                <p className="text-xs text-muted-foreground">Monthly Benefits</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(summary.totalMonthlyBenefits)}
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-annual">
                <p className="text-xs text-muted-foreground">Annual Value</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(summary.totalAnnualBenefits)}
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-programs">
                <p className="text-xs text-muted-foreground">Eligible Programs</p>
                <p className="text-lg font-bold flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {summary.eligibleProgramCount} of {programs.length}
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-benefit-rate">
                <p className="text-xs text-muted-foreground">Benefit Rate</p>
                <p className="text-lg font-bold">
                  {summary.effectiveBenefitRate}%
                </p>
              </div>
            </motion.div>
          )}
          
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" data-testid="error-alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Program Eligibility Cards */}
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-4">
              <AnimatePresence mode="popLayout">
                {programs.length === 0 && !isCalculating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-8 text-muted-foreground"
                    data-testid="empty-state"
                  >
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Enter household data to see eligibility</p>
                  </motion.div>
                )}
                
                {isCalculating && programs.length === 0 && (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-20 w-full" data-testid={`skeleton-${i}`} />
                    ))}
                  </div>
                )}
                
                {programs.map((program, index) => (
                  <motion.div
                    key={program.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    data-testid={`program-card-${program.id}`}
                  >
                    <Card className={`
                      transition-all duration-200
                      ${program.status === 'eligible' 
                        ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' 
                        : 'border-gray-200 dark:border-gray-800'}
                    `}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1">
                            {getStatusIcon(program.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm" data-testid={`program-name-${program.id}`}>
                                  {program.name}
                                </p>
                                {getChangeIndicator(program.change, program.changePercent)}
                              </div>
                              
                              {program.monthlyAmount !== undefined && program.monthlyAmount > 0 && (
                                <p className="text-lg font-bold text-primary mt-1" data-testid={`amount-${program.id}`}>
                                  {formatCurrency(program.monthlyAmount)}/mo
                                </p>
                              )}
                              
                              {program.annualAmount !== undefined && program.annualAmount > 0 && !program.monthlyAmount && (
                                <p className="text-lg font-bold text-primary mt-1" data-testid={`amount-${program.id}`}>
                                  {formatCurrency(program.annualAmount)}/yr
                                </p>
                              )}
                              
                              {program.status === 'eligible' && program.id === 'MD_MEDICAID' && (
                                <Badge variant="secondary" className="mt-1" data-testid="medicaid-badge">
                                  Eligible
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
          
          {/* Smart Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Opportunities & Alerts
              </p>
              <AnimatePresence mode="popLayout">
                {alerts.map((alert, index) => (
                  <motion.div
                    key={`${alert.program}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    data-testid={`alert-${alert.type}-${index}`}
                  >
                    <Alert className={`
                      ${alert.type === 'success' && 'border-green-500/50 bg-green-50 dark:bg-green-950/20'}
                      ${alert.type === 'warning' && 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'}
                      ${alert.type === 'opportunity' && 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20'}
                    `}>
                      <div className="flex items-start gap-2">
                        {getAlertIcon(alert.type)}
                        <div className="flex-1">
                          <AlertDescription className="text-sm">
                            <p className="font-semibold mb-1">{alert.message}</p>
                            {alert.action && (
                              <p className="text-xs text-muted-foreground">{alert.action}</p>
                            )}
                            {alert.estimatedIncrease && (
                              <p className="text-xs font-semibold text-primary mt-1 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Potential increase: ~{formatCurrency(alert.estimatedIncrease)}/mo
                              </p>
                            )}
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          
          {/* Last Updated */}
          {lastUpdated && (
            <p className="text-xs text-muted-foreground text-center" data-testid="last-updated">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

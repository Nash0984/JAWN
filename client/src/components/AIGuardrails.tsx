import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, CheckCircle2, DollarSign, Home, Users, Briefcase, Scale, ExternalLink, Lightbulb } from "lucide-react";

interface GuardrailRule {
  id: string;
  category: string;
  title: string;
  trigger: (data: any) => boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  policyReference: string;
  quickTips: string[];
  trainingLink?: string;
}

const GUARDRAIL_RULES: GuardrailRule[] = [
  {
    id: 'income_verification',
    category: 'wages_salaries',
    title: 'Income Verification Required',
    trigger: (data) => {
      const income = (data?.employmentIncome || 0) + (data?.selfEmploymentIncome || 0);
      return income > 0;
    },
    severity: 'warning',
    message: 'Income verification is the #1 source of payment errors. Ensure you have verified all income sources.',
    policyReference: '7 CFR 273.9 - Income and Deductions',
    quickTips: [
      'Verify income with most recent 4 pay stubs',
      'Check for overtime and variable income patterns',
      'Confirm employer information matches verification',
      'For self-employment, review Schedule SE or profit/loss statements'
    ],
    trainingLink: '/training/income-docs'
  },
  {
    id: 'shelter_deduction_check',
    category: 'shelter_deduction',
    title: 'Shelter Deduction Verification',
    trigger: (data) => {
      return (data?.rentOrMortgage || 0) > 0 || (data?.utilityCosts || 0) > 0;
    },
    severity: 'warning',
    message: 'Shelter deduction errors are common. Verify correct SUA applies and housing costs are documented.',
    policyReference: '7 CFR 273.9(d) - Shelter Deductions',
    quickTips: [
      'Verify which SUA applies based on actual utility payments',
      'Check for seasonal utility adjustments (heating/cooling)',
      'Confirm rent/mortgage documentation is current',
      'Verify heating/cooling costs if claiming separate utilities'
    ],
    trainingLink: '/training/shelter-guide'
  },
  {
    id: 'household_composition_check',
    category: 'household_composition',
    title: 'Household Composition Review',
    trigger: (data) => {
      return (data?.householdSize || 1) > 1;
    },
    severity: 'info',
    message: 'Household composition affects benefit calculations. Confirm all members purchase and prepare food together.',
    policyReference: '7 CFR 273.1 - Household Concept',
    quickTips: [
      'Verify all individuals purchase and prepare food together',
      'Check for separate household claims at same address',
      'Confirm relationship documentation for all members',
      'Review boarder vs household member status'
    ],
    trainingLink: '/training/household-comp'
  },
  {
    id: 'abawd_time_limit',
    category: 'abawd_time_limits',
    title: 'ABAWD Work Requirements Check',
    trigger: (data) => {
      const isWorkingAge = true;
      const noDependents = (data?.householdSize || 1) === 1;
      const notDisabled = !data?.elderlyOrDisabled;
      return isWorkingAge && noDependents && notDisabled;
    },
    severity: 'critical',
    message: 'This case may be subject to ABAWD time limits. Verify work requirement exemptions before finalizing.',
    policyReference: '7 CFR 273.24 - ABAWD Time Limits',
    quickTips: [
      'Check all possible ABAWD exemption categories before applying time limit',
      'Verify 80+ hours of qualifying work activity documentation',
      'Track months of benefits accurately across fiscal years',
      'Confirm exempt status for medical conditions, age, or caretaker responsibilities'
    ],
    trainingLink: '/training/abawd-exemptions'
  },
  {
    id: 'high_assets',
    category: 'resource_eligibility',
    title: 'Resource Limit Review',
    trigger: (data) => {
      const assets = data?.householdAssets || 0;
      const isElderlyDisabled = data?.elderlyOrDisabled;
      const limit = isElderlyDisabled ? 4250 : 2750;
      return assets > limit * 0.8;
    },
    severity: 'warning',
    message: 'Household assets are approaching or exceed resource limits. Verify all countable resources.',
    policyReference: '7 CFR 273.8 - Resource Eligibility',
    quickTips: [
      'Review excluded resources (home, one vehicle, retirement accounts)',
      'Verify elderly/disabled resource limit applies ($4,250 vs $2,750)',
      'Check if categorical eligibility applies (removes resource test)',
      'Document any recently disposed assets'
    ]
  }
];

interface AIGuardrailsProps {
  formData: any;
  isVisible?: boolean;
  onAcknowledge?: (ruleId: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'wages_salaries': return <DollarSign className="h-4 w-4" />;
    case 'shelter_deduction': return <Home className="h-4 w-4" />;
    case 'household_composition': return <Users className="h-4 w-4" />;
    case 'abawd_time_limits': return <Briefcase className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-l-red-500',
        bg: 'bg-red-50 dark:bg-red-950/30',
        icon: 'text-red-600',
        badge: 'bg-red-100 text-red-800'
      };
    case 'warning':
      return {
        border: 'border-l-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        icon: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800'
      };
    default:
      return {
        border: 'border-l-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-800'
      };
  }
};

export function AIGuardrails({ formData, isVisible = true, onAcknowledge }: AIGuardrailsProps) {
  const [acknowledgedRules, setAcknowledgedRules] = useState<Set<string>>(new Set());
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const triggeredRules = GUARDRAIL_RULES.filter(rule => rule.trigger(formData));
  const unacknowledgedRules = triggeredRules.filter(rule => !acknowledgedRules.has(rule.id));

  const handleAcknowledge = (ruleId: string) => {
    setAcknowledgedRules(prev => new Set([...prev, ruleId]));
    onAcknowledge?.(ruleId);
  };

  const toggleExpanded = (ruleId: string) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  if (!isVisible || triggeredRules.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-amber-300 dark:border-amber-700" data-testid="ai-guardrails-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          AI Guardrails - Pre-Submission Checks
        </CardTitle>
        <CardDescription>
          Review these policy reminders before finalizing this case. Per PTIG: "AI guardrails prompt staff with targeted guidance."
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {triggeredRules.map((rule) => {
          const styles = getSeverityStyles(rule.severity);
          const isExpanded = expandedRules.has(rule.id);
          const isAcknowledged = acknowledgedRules.has(rule.id);

          return (
            <div
              key={rule.id}
              className={`border-l-4 rounded-lg p-3 ${styles.border} ${styles.bg} ${isAcknowledged ? 'opacity-60' : ''}`}
              data-testid={`guardrail-${rule.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={styles.icon}>{getCategoryIcon(rule.category)}</span>
                  <span className="font-medium">{rule.title}</span>
                  <Badge className={`text-xs ${styles.badge}`}>{rule.severity}</Badge>
                  {isAcknowledged && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Reviewed
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpanded(rule.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              
              <p className="text-sm mt-2 text-muted-foreground">{rule.message}</p>

              <Collapsible open={isExpanded}>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                    <Scale className="h-3 w-3" />
                    {rule.policyReference}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium">Quick Tips:</span>
                    <ul className="space-y-1 pl-4">
                      {rule.quickTips.map((tip, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {rule.trainingLink && (
                      <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                        <a href={rule.trainingLink}>
                          <BookOpen className="h-3 w-3 mr-1" />
                          Training Materials
                        </a>
                      </Button>
                    )}
                    {!isAcknowledged && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="text-xs h-7"
                        onClick={() => handleAcknowledge(rule.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        I've Reviewed This
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}

        {unacknowledgedRules.length > 0 && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              {unacknowledgedRules.length} guardrail{unacknowledgedRules.length > 1 ? 's' : ''} need{unacknowledgedRules.length === 1 ? 's' : ''} review before submission.
              Click on each to expand and acknowledge.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function useAIGuardrails(formData: any) {
  const [triggeredRules, setTriggeredRules] = useState<GuardrailRule[]>([]);
  
  useEffect(() => {
    const rules = GUARDRAIL_RULES.filter(rule => rule.trigger(formData));
    setTriggeredRules(rules);
  }, [formData]);

  return {
    triggeredRules,
    hasWarnings: triggeredRules.some(r => r.severity === 'warning'),
    hasCritical: triggeredRules.some(r => r.severity === 'critical'),
    canSubmit: true
  };
}

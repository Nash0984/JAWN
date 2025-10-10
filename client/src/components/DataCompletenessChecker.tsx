import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';

interface ClientData {
  clientName?: string;
  clientIdentifier?: string;
  householdSize?: number;
  estimatedIncome?: number;
  benefitProgramId?: string;
  status?: string;
  eligibilityCalculationId?: string;
  applicationSubmittedAt?: string;
  tags?: any;
}

interface SessionData {
  sessionType?: string;
  interactionDate?: string;
  durationMinutes?: number;
  location?: string;
  topicsDiscussed?: string[];
  documentsReceived?: any[];
  documentsVerified?: any[];
  actionItems?: any[];
  notes?: string;
  outcomeStatus?: string;
  pathwayStage?: string;
}

interface DataCompletenessCheckerProps {
  clientData?: ClientData;
  sessionData?: SessionData;
  compact?: boolean;
}

interface FieldStatus {
  category: string;
  fields: {
    name: string;
    label: string;
    completed: boolean;
    required: boolean;
  }[];
}

export function DataCompletenessChecker({ 
  clientData = {}, 
  sessionData = {}, 
  compact = false 
}: DataCompletenessCheckerProps) {
  
  const fieldStatuses = useMemo((): FieldStatus[] => {
    return [
      {
        category: 'Client Identity',
        fields: [
          { 
            name: 'clientName', 
            label: 'Full Name', 
            completed: !!clientData.clientName, 
            required: true 
          },
          { 
            name: 'clientIdentifier', 
            label: 'SSN/Case ID', 
            completed: !!clientData.clientIdentifier, 
            required: true 
          },
          { 
            name: 'benefitProgramId', 
            label: 'Benefit Program', 
            completed: !!clientData.benefitProgramId, 
            required: true 
          },
        ]
      },
      {
        category: 'Household Information',
        fields: [
          { 
            name: 'householdSize', 
            label: 'Household Size', 
            completed: clientData.householdSize !== undefined && clientData.householdSize > 0, 
            required: true 
          },
          { 
            name: 'estimatedIncome', 
            label: 'Estimated Income', 
            completed: clientData.estimatedIncome !== undefined, 
            required: true 
          },
        ]
      },
      {
        category: 'Session Details',
        fields: [
          { 
            name: 'sessionType', 
            label: 'Session Type', 
            completed: !!sessionData.sessionType, 
            required: true 
          },
          { 
            name: 'location', 
            label: 'Location', 
            completed: !!sessionData.location, 
            required: true 
          },
          { 
            name: 'durationMinutes', 
            label: 'Duration', 
            completed: !!sessionData.durationMinutes, 
            required: false 
          },
          { 
            name: 'outcomeStatus', 
            label: 'Outcome Status', 
            completed: !!sessionData.outcomeStatus, 
            required: true 
          },
        ]
      },
      {
        category: 'Supporting Information',
        fields: [
          { 
            name: 'topicsDiscussed', 
            label: 'Topics Discussed', 
            completed: !!sessionData.topicsDiscussed && sessionData.topicsDiscussed.length > 0, 
            required: false 
          },
          { 
            name: 'documentsReceived', 
            label: 'Documents Received', 
            completed: !!sessionData.documentsReceived && sessionData.documentsReceived.length > 0, 
            required: false 
          },
          { 
            name: 'actionItems', 
            label: 'Action Items', 
            completed: !!sessionData.actionItems && sessionData.actionItems.length > 0, 
            required: false 
          },
          { 
            name: 'notes', 
            label: 'Session Notes', 
            completed: !!sessionData.notes && sessionData.notes.length > 10, 
            required: false 
          },
        ]
      },
      {
        category: 'Eligibility & Progress',
        fields: [
          { 
            name: 'eligibilityCalculationId', 
            label: 'Eligibility Calculated', 
            completed: !!clientData.eligibilityCalculationId, 
            required: false 
          },
          { 
            name: 'pathwayStage', 
            label: 'Accountability Pathway', 
            completed: !!sessionData.pathwayStage, 
            required: false 
          },
          { 
            name: 'applicationSubmittedAt', 
            label: 'Application Submitted', 
            completed: !!clientData.applicationSubmittedAt, 
            required: false 
          },
        ]
      },
    ];
  }, [clientData, sessionData]);

  const stats = useMemo(() => {
    const allFields = fieldStatuses.flatMap(cat => cat.fields);
    const requiredFields = allFields.filter(f => f.required);
    const optionalFields = allFields.filter(f => !f.required);
    
    const totalCompleted = allFields.filter(f => f.completed).length;
    const requiredCompleted = requiredFields.filter(f => f.completed).length;
    
    const percentage = Math.round((totalCompleted / allFields.length) * 100);
    const requiredPercentage = requiredFields.length > 0 
      ? Math.round((requiredCompleted / requiredFields.length) * 100) 
      : 0;
    
    return {
      totalFields: allFields.length,
      totalCompleted,
      requiredFields: requiredFields.length,
      requiredCompleted,
      optionalCompleted: totalCompleted - requiredCompleted,
      percentage,
      requiredPercentage,
      allRequiredComplete: requiredCompleted === requiredFields.length
    };
  }, [fieldStatuses]);

  if (compact) {
    return (
      <div className="space-y-2" data-testid="completeness-checker-compact">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {stats.allRequiredComplete ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            <span className="text-sm font-medium">
              Data Completeness: {stats.percentage}%
            </span>
          </div>
          <Badge 
            variant={stats.allRequiredComplete ? "default" : "secondary"}
            data-testid="completeness-badge"
          >
            {stats.requiredCompleted}/{stats.requiredFields} required
          </Badge>
        </div>
        <Progress value={stats.percentage} className="h-2" data-testid="completeness-progress" />
      </div>
    );
  }

  return (
    <Card data-testid="completeness-checker-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Data Completeness</CardTitle>
          <Badge 
            variant={stats.allRequiredComplete ? "default" : "secondary"}
            className="text-xs"
            data-testid="completeness-percentage"
          >
            {stats.percentage}% Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{stats.totalCompleted}/{stats.totalFields} fields</span>
          </div>
          <Progress value={stats.percentage} className="h-2" />
        </div>

        {/* Required vs Optional */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              {stats.allRequiredComplete ? (
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              )}
              <span className="text-xs font-medium">Required</span>
            </div>
            <p className="text-sm">{stats.requiredCompleted}/{stats.requiredFields}</p>
            <Progress value={stats.requiredPercentage} className="h-1" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Optional</span>
            </div>
            <p className="text-sm">{stats.optionalCompleted}/{stats.totalFields - stats.requiredFields}</p>
          </div>
        </div>

        {/* Field Categories */}
        <div className="space-y-3 pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Field Status by Category
          </p>
          {fieldStatuses.map((category) => {
            const completed = category.fields.filter(f => f.completed).length;
            const total = category.fields.length;
            const categoryPercentage = Math.round((completed / total) * 100);

            return (
              <div key={category.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category.category}</span>
                  <span className="text-xs text-muted-foreground">{completed}/{total}</span>
                </div>
                <div className="space-y-1">
                  {category.fields.map((field) => (
                    <div 
                      key={field.name} 
                      className="flex items-center gap-2 text-xs"
                      data-testid={`field-${field.name}`}
                    >
                      {field.completed ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={field.completed ? 'text-foreground' : 'text-muted-foreground'}>
                        {field.label}
                        {field.required && !field.completed && (
                          <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Missing Required Fields Alert */}
        {!stats.allRequiredComplete && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {stats.requiredFields - stats.requiredCompleted} required field(s) missing
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  Complete all required fields before exporting or submitting data
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

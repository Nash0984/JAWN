import { CheckCircle2, Circle, User, DollarSign, Heart, FileText, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Define intake sections based on typical SNAP application flow
const INTAKE_SECTIONS = [
  {
    id: "personal_info",
    name: "Personal Info",
    icon: User,
    keywords: ["name", "address", "phone", "email", "birth", "ssn"],
  },
  {
    id: "household",
    name: "Household",
    icon: Heart,
    keywords: ["household", "family", "members", "dependents", "children"],
  },
  {
    id: "income",
    name: "Income",
    icon: DollarSign,
    keywords: ["income", "wages", "salary", "employment", "job", "earnings"],
  },
  {
    id: "benefits",
    name: "Benefits",
    icon: Shield,
    keywords: ["benefits", "assistance", "medicaid", "tanf", "ssi", "disability"],
  },
  {
    id: "expenses",
    name: "Expenses",
    icon: FileText,
    keywords: ["expenses", "rent", "utilities", "medical", "childcare", "shelter"],
  },
];

interface IntakeCopilotProgressIndicatorProps {
  extractedData: Record<string, any>;
  currentStep: string;
  dataCompleteness: number;
  missingFields: string[];
  className?: string;
}

// Helper function to determine which sections are completed based on extracted data
function getSectionCompletionStatus(extractedData: Record<string, any>) {
  const completedSections: string[] = [];
  const extractedFields = Object.keys(extractedData || {}).map(k => k.toLowerCase());

  INTAKE_SECTIONS.forEach(section => {
    // Check if any keywords from this section are present in extracted fields
    const hasMatchingField = section.keywords.some(keyword =>
      extractedFields.some(field => field.includes(keyword))
    );

    if (hasMatchingField) {
      completedSections.push(section.id);
    }
  });

  return completedSections;
}

export function IntakeCopilotProgressIndicator({
  extractedData,
  currentStep,
  dataCompleteness,
  missingFields,
  className,
}: IntakeCopilotProgressIndicatorProps) {
  const completedSections = getSectionCompletionStatus(extractedData);
  const totalSections = INTAKE_SECTIONS.length;
  const completedCount = completedSections.length;
  const percentComplete = Math.round(dataCompleteness * 100);

  // Determine current section based on step name or missing fields
  const currentSectionId = (() => {
    const stepLower = currentStep?.toLowerCase() || "";
    const section = INTAKE_SECTIONS.find(s => 
      stepLower.includes(s.id) || s.keywords.some(k => stepLower.includes(k))
    );
    return section?.id || null;
  })();

  return (
    <div
      className={cn("bg-card border border-border rounded-lg p-4", className)}
      role="region"
      aria-label="Application progress"
      data-testid="intake-copilot-progress"
    >
      {/* Header with completion status */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" data-testid="text-sections-complete">
            {completedCount} of {totalSections} sections complete
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {currentStep?.replace(/_/g, " ") || "Getting started"}
          </p>
        </div>
        <Badge
          variant="secondary"
          className="text-sm px-3 py-1.5 min-h-[44px] flex items-center justify-center"
          data-testid="badge-completion-percentage"
        >
          {percentComplete}%
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <Progress
          value={percentComplete}
          className="h-2"
          aria-label={`${percentComplete}% complete`}
          data-testid="progress-bar-copilot"
        />
      </div>

      {/* Section Indicators - Desktop */}
      <div className="hidden sm:grid grid-cols-5 gap-2">
        {INTAKE_SECTIONS.map(section => {
          const isCompleted = completedSections.includes(section.id);
          const isCurrent = currentSectionId === section.id;
          const SectionIcon = section.icon;

          return (
            <div
              key={section.id}
              className={cn(
                "flex flex-col items-center text-center p-2 rounded-lg transition-all",
                isCurrent && "bg-primary/10 border border-primary"
              )}
              data-testid={`section-${section.id}`}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all",
                  "border-2",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground",
                  isCurrent &&
                    !isCompleted &&
                    "bg-primary/10 border-primary text-primary",
                  !isCompleted &&
                    !isCurrent &&
                    "bg-muted border-muted-foreground/20 text-muted-foreground"
                )}
                role="img"
                aria-label={
                  isCompleted
                    ? `${section.name} section completed`
                    : isCurrent
                    ? `Current section: ${section.name}`
                    : `${section.name} section`
                }
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <SectionIcon className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div
                className={cn(
                  "text-xs font-medium truncate w-full",
                  isCurrent && "text-primary",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {section.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section Indicators - Mobile (Compact List) */}
      <div className="sm:hidden space-y-1.5">
        {INTAKE_SECTIONS.map(section => {
          const isCompleted = completedSections.includes(section.id);
          const isCurrent = currentSectionId === section.id;
          const SectionIcon = section.icon;

          return (
            <div
              key={section.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg transition-all",
                "min-h-[44px]",
                isCurrent && "bg-primary/10 border border-primary"
              )}
              data-testid={`section-mobile-${section.id}`}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  "border-2 transition-all",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground",
                  isCurrent &&
                    !isCompleted &&
                    "bg-primary/10 border-primary text-primary",
                  !isCompleted &&
                    !isCurrent &&
                    "bg-muted border-muted-foreground/20 text-muted-foreground"
                )}
                role="img"
                aria-label={
                  isCompleted
                    ? `${section.name} completed`
                    : isCurrent
                    ? `Current: ${section.name}`
                    : section.name
                }
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <SectionIcon className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium truncate",
                    isCurrent && "text-primary",
                    !isCurrent && "text-muted-foreground"
                  )}
                >
                  {section.name}
                </div>
              </div>
              {isCompleted && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Done
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Missing Fields Alert */}
      {missingFields && missingFields.length > 0 && missingFields.length <= 3 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-1">
            Still needed:
          </p>
          <div className="flex flex-wrap gap-1">
            {missingFields.slice(0, 3).map((field, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                data-testid={`badge-missing-${idx}`}
              >
                {field.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

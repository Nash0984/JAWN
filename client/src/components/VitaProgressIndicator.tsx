import { CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface VitaProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  sticky?: boolean;
}

export function VitaProgressIndicator({
  steps,
  currentStep,
  className,
  sticky = true,
}: VitaProgressIndicatorProps) {
  const totalSteps = steps.length;
  const percentComplete = Math.round((currentStep / totalSteps) * 100);
  const completedSteps = currentStep - 1;

  return (
    <div
      className={cn(
        "bg-background border-b border-border z-10",
        sticky && "sticky top-0",
        className
      )}
      role="navigation"
      aria-label="Form progress"
      data-testid="progress-indicator"
    >
      <div className="container mx-auto px-4 py-4">
        {/* Progress Header - Mobile and Desktop */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-progress-title">
              Step {currentStep} of {totalSteps}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-progress-subtitle">
              {steps[currentStep - 1]?.title}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="text-sm px-3 py-1 min-h-[44px] min-w-[80px] flex items-center justify-center"
            data-testid="badge-progress-percentage"
          >
            {percentComplete}% Complete
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <Progress
            value={percentComplete}
            className="h-2"
            aria-label={`${percentComplete}% complete`}
            data-testid="progress-bar"
          />
        </div>

        {/* Desktop Step Indicators - Horizontal Layout */}
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-2">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const isCompleted = stepNumber < currentStep;
              const isCurrent = stepNumber === currentStep;
              const StepIcon = step.icon;

              return (
                <div
                  key={step.number}
                  className="flex-1 flex flex-col items-center text-center"
                  data-testid={`step-indicator-${stepNumber}`}
                >
                  {/* Step Circle with Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all",
                      "border-2",
                      isCompleted &&
                        "bg-primary border-primary text-primary-foreground",
                      isCurrent &&
                        "bg-primary/10 border-primary text-primary scale-110",
                      !isCompleted &&
                        !isCurrent &&
                        "bg-muted border-muted-foreground/20 text-muted-foreground"
                    )}
                    role="img"
                    aria-label={
                      isCompleted
                        ? `Step ${stepNumber}: ${step.title} - Completed`
                        : isCurrent
                        ? `Step ${stepNumber}: ${step.title} - Current step`
                        : `Step ${stepNumber}: ${step.title} - Not started`
                    }
                    data-testid={`step-circle-${stepNumber}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                    ) : (
                      <StepIcon className="w-6 h-6" aria-hidden="true" />
                    )}
                  </div>

                  {/* Step Title */}
                  <div
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent && "text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}
                    data-testid={`step-title-${stepNumber}`}
                  >
                    {step.title}
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div
                      className="absolute top-6 left-[calc(50%+24px)] w-[calc(100%-48px)] h-0.5 -translate-y-1/2"
                      style={{
                        left: `calc(${(100 / steps.length) * (index + 0.5)}% + 24px)`,
                        width: `calc(${100 / steps.length}% - 48px)`,
                      }}
                    >
                      <div
                        className={cn(
                          "h-full transition-colors",
                          isCompleted ? "bg-primary" : "bg-muted"
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Step Indicators - Compact List */}
        <div className="md:hidden space-y-2">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;

            return (
              <div
                key={step.number}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all",
                  "min-h-[44px]", // Ensure 44px minimum touch target
                  isCurrent && "bg-primary/10 border border-primary"
                )}
                data-testid={`step-mobile-${stepNumber}`}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    "border-2 transition-all",
                    isCompleted &&
                      "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-primary/10 border-primary text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-muted border-muted-foreground/20 text-muted-foreground"
                  )}
                  role="img"
                  aria-label={
                    isCompleted
                      ? `Step ${stepNumber} completed`
                      : isCurrent
                      ? `Current step ${stepNumber}`
                      : `Step ${stepNumber}`
                  }
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Circle
                      className={cn(
                        "w-5 h-5",
                        isCurrent && "fill-primary"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm font-medium truncate",
                      isCurrent && "text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {stepNumber}. {step.title}
                  </div>
                  {isCurrent && (
                    <div className="text-xs text-muted-foreground truncate">
                      {step.description}
                    </div>
                  )}
                </div>

                {/* Completion Badge */}
                {isCompleted && (
                  <Badge
                    variant="secondary"
                    className="text-xs flex-shrink-0"
                    data-testid={`badge-completed-${stepNumber}`}
                  >
                    Done
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        <Separator className="mt-4" />
      </div>
    </div>
  );
}

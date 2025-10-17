import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";
import { differenceInDays, format, isPast } from "date-fns";

interface DeadlineIndicatorProps {
  dueDate: Date | string;
  className?: string;
  showIcon?: boolean;
}

export function DeadlineIndicator({
  dueDate,
  className,
  showIcon = true
}: DeadlineIndicatorProps) {
  const dateObj = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const today = new Date();
  const daysRemaining = differenceInDays(dateObj, today);
  const isOverdue = isPast(dateObj) && daysRemaining < 0;
  const isUrgent = daysRemaining <= 2 && daysRemaining >= 0;

  const getUrgencyColor = () => {
    if (isOverdue) return "text-destructive";
    if (isUrgent) return "text-orange-600 dark:text-orange-400";
    return "text-muted-foreground";
  };

  const getUrgencyText = () => {
    if (isOverdue) return `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`;
    if (daysRemaining === 0) return "Due today";
    if (daysRemaining === 1) return "Due tomorrow";
    return `${daysRemaining} days remaining`;
  };

  const Icon = isOverdue || isUrgent ? AlertTriangle : Clock;

  return (
    <div
      className={cn("flex items-center gap-2", getUrgencyColor(), className)}
      data-testid="deadline-indicator"
    >
      {showIcon && <Icon className="h-4 w-4" aria-hidden="true" />}
      <div className="flex flex-col">
        <span className="text-sm font-medium" data-testid="text-deadline-urgency">
          {getUrgencyText()}
        </span>
        <span className="text-xs" data-testid="text-deadline-date">
          Due: {format(dateObj, "MMM d, yyyy")}
        </span>
      </div>
    </div>
  );
}

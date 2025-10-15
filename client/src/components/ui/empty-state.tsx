import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  "data-testid"?: string;
}

const colorClasses: Record<string, { bg: string; icon: string }> = {
  gray: {
    bg: "bg-gray-100 dark:bg-gray-950",
    icon: "text-gray-600",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-950",
    icon: "text-green-600",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-950",
    icon: "text-blue-600",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-950",
    icon: "text-red-600",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-950",
    icon: "text-yellow-600",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-950",
    icon: "text-purple-600",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-950",
    icon: "text-orange-600",
  },
};

export function EmptyState({
  icon: Icon,
  iconColor = "gray",
  title,
  description,
  action,
  "data-testid": dataTestId,
}: EmptyStateProps) {
  const colors = colorClasses[iconColor] || colorClasses.gray;

  return (
    <div className="text-center py-12" data-testid={dataTestId}>
      <div
        className={cn(
          "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4",
          colors.bg
        )}
      >
        <Icon className={cn("h-8 w-8", colors.icon)} />
      </div>
      <p className="text-xl font-semibold mb-2">{title}</p>
      {description && <p className="text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

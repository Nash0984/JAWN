import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface MDAlertProps {
  variant: "info" | "warning" | "error" | "success" | "restricted";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MDAlert({ variant, title, children, className }: MDAlertProps) {
  const variants = {
    info: {
      icon: Info,
      bgColor: "bg-md-blue/10 dark:bg-md-blue/20",
      borderColor: "border-l-4 border-md-blue",
      iconColor: "text-md-blue",
      titleColor: "text-md-blue",
      ariaLabel: "Information alert"
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-md-gold/10 dark:bg-md-gold/20",
      borderColor: "border-l-4 border-md-gold",
      iconColor: "text-md-gold",
      titleColor: "text-md-gold",
      ariaLabel: "Warning alert"
    },
    error: {
      icon: AlertCircle,
      bgColor: "bg-md-red/10 dark:bg-md-red/20",
      borderColor: "border-l-4 border-md-red",
      iconColor: "text-md-red",
      titleColor: "text-md-red",
      ariaLabel: "Error alert"
    },
    success: {
      icon: CheckCircle2,
      bgColor: "bg-success/10 dark:bg-success/20",
      borderColor: "border-l-4 border-success",
      iconColor: "text-success",
      titleColor: "text-success",
      ariaLabel: "Success alert"
    },
    restricted: {
      icon: ShieldAlert,
      bgColor: "bg-md-red/10 dark:bg-md-red/20",
      borderColor: "border-l-4 border-md-red",
      iconColor: "text-md-red",
      titleColor: "text-md-red",
      ariaLabel: "Restricted access alert"
    }
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      aria-label={config.ariaLabel}
      className={cn(
        "rounded-md p-4",
        config.bgColor,
        config.borderColor,
        className
      )}
      data-testid={`alert-${variant}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconColor)} aria-hidden="true" />
        <div className="flex-1">
          {title && (
            <h3 className={cn("text-sm font-semibold mb-1", config.titleColor)}>
              {title}
            </h3>
          )}
          <div className="text-sm text-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

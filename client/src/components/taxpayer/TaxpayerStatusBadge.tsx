import { cn } from "@/lib/utils";
import { CheckCircle, Clock, XCircle, FileCheck } from "lucide-react";

export type TaxpayerStatus = "pending" | "fulfilled" | "submitted" | "approved" | "rejected" | "cancelled";

interface TaxpayerStatusBadgeProps {
  status: TaxpayerStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
    icon: Clock
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    icon: FileCheck
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
    icon: CheckCircle
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
    icon: CheckCircle
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
    icon: XCircle
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    icon: XCircle
  }
};

export function TaxpayerStatusBadge({ status, className, showIcon = true }: TaxpayerStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
        config.className,
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {config.label}
    </span>
  );
}

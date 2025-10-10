import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";

export type StatusType = "significant" | "accepted" | "pending" | "rejected" | "approved" | "needs_more_info";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  significant: {
    label: "Significant",
    className: "bg-md-red text-white",
    icon: AlertTriangle
  },
  accepted: {
    label: "Accepted",
    className: "bg-success text-white",
    icon: CheckCircle
  },
  approved: {
    label: "Approved",
    className: "bg-success text-white",
    icon: CheckCircle
  },
  pending: {
    label: "Pending",
    className: "bg-warning text-warning-foreground",
    icon: Clock
  },
  rejected: {
    label: "Rejected",
    className: "bg-md-red text-white",
    icon: XCircle
  },
  needs_more_info: {
    label: "Needs More Info",
    className: "bg-warning text-warning-foreground",
    icon: AlertTriangle
  }
};

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
        config.className,
        className
      )}
      data-testid={`badge-status-${status}`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}

export function DocumentStatusBadge({ 
  verificationStatus, 
  className 
}: { 
  verificationStatus: string; 
  className?: string;
}) {
  const statusMap: Record<string, StatusType> = {
    'approved': 'approved',
    'rejected': 'rejected',
    'pending_review': 'pending',
    'needs_more_info': 'needs_more_info'
  };

  const badgeStatus = statusMap[verificationStatus] || 'pending';

  return <StatusBadge status={badgeStatus} className={className} showIcon />;
}

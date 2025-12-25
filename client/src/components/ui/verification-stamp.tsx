import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationStampProps {
  status: "approved" | "verified" | "rejected" | "pending";
  className?: string;
}

export function VerificationStamp({ status, className }: VerificationStampProps) {
  const stamps: Record<VerificationStampProps["status"], {
    icon: typeof CheckCircle;
    label: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    ariaLabel: string;
  }> = {
    approved: {
      icon: CheckCircle,
      label: "APPROVED",
      bgColor: "bg-success/90",
      borderColor: "border-success",
      textColor: "text-white",
      ariaLabel: "Document approved"
    },
    verified: {
      icon: CheckCircle,
      label: "VERIFIED",
      bgColor: "bg-success/90",
      borderColor: "border-success",
      textColor: "text-white",
      ariaLabel: "Document verified"
    },
    rejected: {
      icon: XCircle,
      label: "REJECTED",
      bgColor: "bg-md-red/90",
      borderColor: "border-md-red",
      textColor: "text-white",
      ariaLabel: "Document rejected"
    },
    pending: {
      icon: AlertTriangle,
      label: "PENDING",
      bgColor: "bg-md-gold/90",
      borderColor: "border-md-gold",
      textColor: "text-black",
      ariaLabel: "Document pending review"
    }
  };

  // Defensive handling: fallback to a default stamp if status is invalid
  const stamp = stamps[status] || {
    icon: HelpCircle,
    label: "UNKNOWN",
    bgColor: "bg-gray-500/90",
    borderColor: "border-gray-600",
    textColor: "text-white",
    ariaLabel: "Document status unknown"
  };
  
  const Icon = stamp.icon;

  return (
    <div 
      className={cn(
        "absolute top-4 right-4 px-4 py-2 rounded-md shadow-lg border-2 rotate-12 pointer-events-none",
        stamp.bgColor,
        stamp.borderColor,
        stamp.textColor,
        className
      )}
      data-testid={`badge-${status}-stamp`}
      aria-label={stamp.ariaLabel}
    >
      <div className="flex items-center space-x-2">
        <Icon className="h-5 w-5" aria-hidden="true" />
        <span className="font-bold text-lg tracking-wider">{stamp.label}</span>
      </div>
    </div>
  );
}

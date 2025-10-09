import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PolicyEngineVerificationBadgeProps {
  isMatch: boolean;
  confidenceScore: number;
  variancePercentage?: number | null;
  compact?: boolean;
  className?: string;
}

export function PolicyEngineVerificationBadge({
  isMatch,
  confidenceScore,
  variancePercentage,
  compact = false,
  className = ''
}: PolicyEngineVerificationBadgeProps) {
  // Determine badge appearance based on verification result
  const getBadgeVariant = () => {
    if (!isMatch) return 'destructive';
    if (confidenceScore >= 0.9) return 'default';
    if (confidenceScore >= 0.7) return 'secondary';
    return 'outline';
  };

  const getIcon = () => {
    if (!isMatch) return ShieldAlert;
    if (confidenceScore >= 0.9) return ShieldCheck;
    if (confidenceScore >= 0.7) return Shield;
    return ShieldQuestion;
  };

  const getTooltipText = () => {
    if (!isMatch) {
      return `Verification failed${variancePercentage != null ? ` (${variancePercentage.toFixed(1)}% variance)` : ''}. Result differs from PolicyEngine calculation.`;
    }
    
    if (confidenceScore >= 0.9) {
      return `Verified by PolicyEngine ✓ (${(confidenceScore * 100).toFixed(0)}% confidence${variancePercentage != null ? `, ${variancePercentage.toFixed(1)}% variance` : ''})`;
    }
    
    if (confidenceScore >= 0.7) {
      return `Verified with minor variance (${(confidenceScore * 100).toFixed(0)}% confidence${variancePercentage != null ? `, ${variancePercentage.toFixed(1)}% variance` : ''})`;
    }
    
    return `Low confidence verification (${(confidenceScore * 100).toFixed(0)}% confidence)`;
  };

  const getBadgeText = () => {
    if (compact) {
      return isMatch ? '✓' : '✗';
    }
    
    if (!isMatch) return 'Verification Failed';
    if (confidenceScore >= 0.9) return 'Verified by PolicyEngine ✓';
    if (confidenceScore >= 0.7) return 'Verified (Minor Variance)';
    return 'Low Confidence';
  };

  const Icon = getIcon();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getBadgeVariant()} 
            className={`gap-1.5 ${className}`}
            data-testid={`verification-badge-${isMatch ? 'pass' : 'fail'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{getBadgeText()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface VerificationStatsDisplayProps {
  stats: {
    totalVerifications: number;
    matchRate: number;
    averageConfidence: number;
    averageVariancePercent: number;
  };
  programName: string;
}

export function VerificationStatsDisplay({ stats, programName }: VerificationStatsDisplayProps) {
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="verification-stats">
      <h3 className="text-sm font-semibold mb-3">
        PolicyEngine Verification Stats - {programName}
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total Verifications</p>
          <p className="text-2xl font-bold" data-testid="stat-total">
            {stats.totalVerifications}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground">Match Rate</p>
          <p className="text-2xl font-bold" data-testid="stat-match-rate">
            {stats.matchRate.toFixed(1)}%
          </p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground">Avg Confidence</p>
          <p className="text-2xl font-bold" data-testid="stat-confidence">
            {(stats.averageConfidence * 100).toFixed(0)}%
          </p>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground">Avg Variance</p>
          <p className="text-2xl font-bold" data-testid="stat-variance">
            {stats.averageVariancePercent.toFixed(1)}%
          </p>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span>
            All calculations are independently verified against PolicyEngine's benefit calculator
          </span>
        </div>
      </div>
    </div>
  );
}

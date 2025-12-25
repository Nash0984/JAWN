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
  confidenceScore?: number;
  variancePercentage?: number | null;
  // New props for hybrid endpoint compatibility
  difference?: number; // Dollar difference between primary and PolicyEngine calculation
  primaryAmount?: number; // Primary calculation amount
  compact?: boolean;
  className?: string;
}

export function PolicyEngineVerificationBadge({
  isMatch,
  confidenceScore,
  variancePercentage,
  difference,
  primaryAmount,
  compact = false,
  className = ''
}: PolicyEngineVerificationBadgeProps) {
  
  // Calculate variance percentage from difference if not provided
  const calculatedVariance = variancePercentage ?? 
    (difference !== undefined && primaryAmount && primaryAmount > 0 
      ? Math.abs((difference / primaryAmount) * 100) 
      : null);
  
  // Use confidence score if provided, otherwise derive from match status
  const effectiveConfidence = confidenceScore ?? (isMatch ? 1.0 : 0.0);
  
  // Determine badge appearance based on verification result
  const getBadgeVariant = () => {
    if (!isMatch) return 'destructive';
    if (effectiveConfidence >= 0.9) return 'default';
    if (effectiveConfidence >= 0.7) return 'secondary';
    return 'outline';
  };

  const getIcon = () => {
    if (!isMatch) return ShieldAlert;
    if (effectiveConfidence >= 0.9) return ShieldCheck;
    if (effectiveConfidence >= 0.7) return Shield;
    return ShieldQuestion;
  };

  const getTooltipText = () => {
    if (!isMatch) {
      const diffText = difference !== undefined ? ` ($${Math.abs(difference).toFixed(2)} difference)` : '';
      const varText = calculatedVariance != null ? ` (${calculatedVariance.toFixed(1)}% variance)` : '';
      return `Verification failed${diffText}${varText}. Result differs from PolicyEngine calculation.`;
    }
    
    if (effectiveConfidence >= 0.9) {
      const confText = confidenceScore !== undefined ? ` (${(confidenceScore * 100).toFixed(0)}% confidence)` : '';
      const varText = calculatedVariance != null ? `, ${calculatedVariance.toFixed(1)}% variance` : '';
      return `Verified by PolicyEngine ✓${confText}${varText}`;
    }
    
    if (effectiveConfidence >= 0.7) {
      const confText = confidenceScore !== undefined ? ` (${(confidenceScore * 100).toFixed(0)}% confidence)` : '';
      const varText = calculatedVariance != null ? `, ${calculatedVariance.toFixed(1)}% variance` : '';
      return `Verified with minor variance${confText}${varText}`;
    }
    
    return `Low confidence verification (${(effectiveConfidence * 100).toFixed(0)}% confidence)`;
  };

  const getBadgeText = () => {
    if (compact) {
      return isMatch ? '✓' : '✗';
    }
    
    if (!isMatch) return 'Verification Failed';
    if (effectiveConfidence >= 0.9) return 'Verified by PolicyEngine ✓';
    if (effectiveConfidence >= 0.7) return 'Verified (Minor Variance)';
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

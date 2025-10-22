import { useTenant } from '@/contexts/TenantContext';

interface TenantSealProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showFallback?: boolean;
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

/**
 * TenantSeal - Dynamic state seal component
 * Loads the appropriate state seal based on tenant configuration
 * Replaces hardcoded Maryland seal/flag components
 */
export const TenantSeal = ({ 
  className,
  size = 'md',
  showFallback = true,
  ...rest 
}: TenantSealProps) => {
  const { stateConfig, tenant } = useTenant();
  
  const stateCode = stateConfig?.stateCode || 'MD';
  const stateName = stateConfig?.stateName || tenant?.name || 'State';
  const sealPath = `/assets/${stateCode.toLowerCase()}/seal.svg`;
  
  const sizeClass = sizeMap[size];
  const finalClassName = className || sizeClass;
  
  return (
    <img
      src={sealPath}
      alt={`${stateName} State Seal`}
      className={finalClassName}
      aria-label={`${stateName} State Seal`}
      onError={(e) => {
        if (showFallback) {
          // Fallback to generic seal if state seal not found
          (e.target as HTMLImageElement).src = '/assets/generic-seal.svg';
        } else {
          // Hide image if no fallback desired
          (e.target as HTMLImageElement).style.display = 'none';
        }
      }}
      {...rest}
    />
  );
};

/**
 * Alias for backward compatibility
 */
export const StateSeal = TenantSeal;

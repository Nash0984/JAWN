import { useTenant } from '@/contexts/TenantContext';

interface TenantLogoProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'primary' | 'secondary' | 'seal' | 'text';
  className?: string;
  fallback?: boolean; // Show fallback if logo not available
}

/**
 * TenantLogo - Dynamic logo component that adapts to the current tenant
 * Replaces hardcoded MarylandLogo with multi-state support
 */
export const TenantLogo = ({ 
  variant = 'primary', 
  className = "h-10 w-10",
  fallback = true,
  ...rest
}: TenantLogoProps) => {
  const { tenant, branding, stateConfig } = useTenant();
  
  const stateCode = stateConfig?.stateCode || 'MD';
  const stateName = stateConfig?.stateName || 'State';
  const abbreviation = stateConfig?.abbreviation || stateCode;
  
  // If custom logo URL is provided, use it
  if (branding?.logoUrl && (variant === 'primary' || variant === 'seal')) {
    return (
      <img
        src={branding.logoUrl}
        alt={`${stateName} Logo`}
        className={className}
        aria-label={`${stateName} Logo`}
        {...(rest as any)}
      />
    );
  }
  
  // Try to load state seal
  if (variant === 'seal') {
    const sealPath = `/assets/${stateCode.toLowerCase()}/seal.svg`;
    return (
      <img
        src={sealPath}
        alt={`${stateName} State Seal`}
        className={className}
        aria-label={`${stateName} State Seal`}
        onError={(e) => {
          // Fallback to generic seal if state seal not found
          if (fallback) {
            (e.target as HTMLImageElement).src = '/assets/generic-seal.svg';
          }
        }}
        {...(rest as any)}
      />
    );
  }
  
  // Text-only variant (state name)
  if (variant === 'text') {
    return (
      <div 
        className={`font-bold text-brand-primary ${className}`}
        {...(rest as any)}
      >
        {stateName}
      </div>
    );
  }
  
  // Generate dynamic SVG logo based on tenant branding
  const primaryColor = branding?.primaryColor || 'hsl(var(--brand-primary))';
  const secondaryColor = branding?.secondaryColor || 'hsl(var(--brand-secondary))';
  
  if (variant === 'secondary') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        aria-label={`${stateName} Logo`}
        {...(rest as any)}
      >
        <rect width="100" height="100" fill={secondaryColor} rx="8" />
        <circle 
          cx="50" 
          cy="50" 
          r="35" 
          fill="none" 
          stroke={primaryColor} 
          strokeWidth="4"
        />
        <text 
          x="50" 
          y="62" 
          fontFamily="Montserrat, sans-serif" 
          fontSize={abbreviation.length > 2 ? "28" : "40"} 
          fontWeight="700" 
          fill={primaryColor} 
          textAnchor="middle"
        >
          {abbreviation}
        </text>
      </svg>
    );
  }
  
  // Primary variant (default)
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-label={`${stateName} Logo`}
      {...(rest as any)}
    >
      <rect width="100" height="100" fill={primaryColor} rx="8" />
      <circle 
        cx="50" 
        cy="50" 
        r="35" 
        fill="none" 
        stroke={secondaryColor} 
        strokeWidth="4"
      />
      <text 
        x="50" 
        y="62" 
        fontFamily="Montserrat, sans-serif" 
        fontSize={abbreviation.length > 2 ? "28" : "40"} 
        fontWeight="700" 
        fill={secondaryColor} 
        textAnchor="middle"
      >
        {abbreviation}
      </text>
    </svg>
  );
};

/**
 * Alias for backward compatibility
 */
export const StateLogo = TenantLogo;

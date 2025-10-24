import { MarylandAssets } from '@/assets/maryland';

interface MarylandLogoProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'primary' | 'secondary' | 'seal' | 'flag';
  className?: string;
}

export const MarylandLogo = ({ 
  variant = 'primary', 
  className = "h-10 w-10",
  ...rest
}: MarylandLogoProps) => {
  if (variant === 'seal') {
    return (
      <img
        src={MarylandAssets.seal}
        alt="Maryland State Seal"
        className={className}
        aria-label="Maryland State Seal"
        {...(rest as any)}
      />
    );
  }

  if (variant === 'flag') {
    return (
      <img
        src={MarylandAssets.flag}
        alt="Maryland State Flag"
        className={className}
        aria-label="Maryland State Flag"
        {...(rest as any)}
      />
    );
  }

  if (variant === 'secondary') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        aria-label="Maryland Logo"
        {...(rest as any)}
      >
        <rect width="100" height="100" fill="hsl(43, 100%, 61%)" />
        <circle cx="50" cy="50" r="35" fill="none" stroke="hsl(351, 84%, 43%)" strokeWidth="4"/>
        <text 
          x="50" 
          y="60" 
          fontFamily="Inter, sans-serif" 
          fontSize="40" 
          fontWeight="600" 
          fill="hsl(351, 84%, 43%)" 
          textAnchor="middle"
        >
          MD
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-label="Maryland Logo"
      {...(rest as any)}
    >
      <rect width="100" height="100" fill="hsl(351, 84%, 43%)" />
      <circle cx="50" cy="50" r="35" fill="none" stroke="hsl(43, 100%, 61%)" strokeWidth="4"/>
      <text 
        x="50" 
        y="60" 
        fontFamily="Inter, sans-serif" 
        fontSize="40" 
        fontWeight="600" 
        fill="hsl(43, 100%, 61%)" 
        textAnchor="middle"
      >
        MD
      </text>
    </svg>
  );
};

import { useEffect, useState } from "react";
import { Router as WouterRouter, useLocation } from "wouter";
import { useTenant } from "@/contexts/TenantContext";

interface StateRouterProps {
  children: React.ReactNode;
}

// List of valid state codes for routing
const VALID_STATE_CODES = [
  'MD', 'PA', 'NJ', 'DE', 'VA', 'NY', 'NYC', 'DC',
  'CA', 'TX', 'FL', 'OH', 'GA', 'NC', 'MI', 'IL',
  'MA', 'WA', 'CO', 'AZ'
];

export function StateRouter({ children }: StateRouterProps) {
  const [base, setBase] = useState("/");
  const [, setLocation] = useLocation();
  const { stateCode } = useTenant();

  useEffect(() => {
    // Parse current URL to detect state prefix
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/').filter(Boolean);
    
    if (pathParts.length > 0) {
      const firstPart = pathParts[0].toUpperCase();
      
      // Check if the first part of the path is a valid state code
      if (VALID_STATE_CODES.includes(firstPart)) {
        // Set the base path for wouter to include the state prefix
        setBase(`/${firstPart.toLowerCase()}`);
      } else {
        // No state prefix in URL, check if we have a state from context
        if (stateCode && VALID_STATE_CODES.includes(stateCode)) {
          // Redirect to state-specific path
          const newPath = `/${stateCode.toLowerCase()}${currentPath}`;
          window.location.pathname = newPath;
        } else {
          // Default to Maryland if no state is specified
          const defaultState = 'md';
          const newPath = `/${defaultState}${currentPath}`;
          window.location.pathname = newPath;
        }
      }
    } else {
      // Root path - redirect to default state
      const defaultState = stateCode?.toLowerCase() || 'md';
      window.location.pathname = `/${defaultState}/`;
    }
  }, [stateCode]);

  return (
    <WouterRouter base={base}>
      {children}
    </WouterRouter>
  );
}

// Hook to get state-aware navigation
export function useStateNavigation() {
  const [, setLocation] = useLocation();
  const { stateCode } = useTenant();
  
  const navigate = (path: string, includeState = true) => {
    if (includeState && stateCode) {
      // Ensure the path doesn't already include the state prefix
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const stateLower = stateCode.toLowerCase();
      
      // Check if path already has state prefix
      if (!cleanPath.startsWith(`/${stateLower}/`)) {
        setLocation(`/${stateLower}${cleanPath}`);
      } else {
        setLocation(cleanPath);
      }
    } else {
      setLocation(path);
    }
  };
  
  return { navigate };
}

// Component to handle state-specific links
interface StateAwareLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  includeState?: boolean;
  [key: string]: any;
}

export function StateAwareLink({ 
  href, 
  children, 
  className, 
  includeState = true,
  ...props 
}: StateAwareLinkProps) {
  const { stateCode } = useTenant();
  
  const stateHref = includeState && stateCode 
    ? `/${stateCode.toLowerCase()}${href.startsWith('/') ? href : `/${href}`}`
    : href;
  
  return (
    <a href={stateHref} className={className} {...props}>
      {children}
    </a>
  );
}
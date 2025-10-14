import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TenantBranding {
  id: string;
  tenantId: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
  headerHtml?: string;
  footerHtml?: string;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: 'state' | 'county';
  parentTenantId?: string;
  config?: any;
}

interface TenantContextValue {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  isLoading: boolean;
  error: Error | null;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenantError, setTenantError] = useState<Error | null>(null);

  // Fetch current tenant info
  const { data, isLoading, error } = useQuery<{ tenant: Tenant; branding?: TenantBranding }>({
    queryKey: ['/api/tenant/current'],
    retry: false, // Don't retry if tenant not found
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  useEffect(() => {
    if (error) {
      setTenantError(error as Error);
    }
  }, [error]);

  const value: TenantContextValue = {
    tenant: data?.tenant || null,
    branding: data?.branding || null,
    isLoading,
    error: tenantError,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

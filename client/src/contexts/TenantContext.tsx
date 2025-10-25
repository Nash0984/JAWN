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

interface StateConfiguration {
  id: string;
  tenantId: string;
  stateName: string;
  stateCode: string;
  abbreviation: string;
  timezone: string;
  region: string;
  agencyName: string;
  agencyAcronym: string;
  agencyWebsite?: string;
  agencyAddress?: string;
  agencyPhone?: string;
  agencyEmail?: string;
  supportPhone?: string;
  supportEmail?: string;
  supportHours?: string;
  supportLanguages?: string[];
  features?: {
    enableVita?: boolean;
    enableSms?: boolean;
    enableChat?: boolean;
    enableAppointments?: boolean;
    enableDocumentUpload?: boolean;
  };
  isActive: boolean;
}

interface TenantContextValue {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  stateConfig: StateConfiguration | null;
  stateCode: string | null;
  isLoading: boolean;
  error: Error | null;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenantError, setTenantError] = useState<Error | null>(null);
  
  // Extract state code from URL
  const currentPath = window.location.pathname;
  const stateMatch = currentPath.match(/^\/([a-z]+)\//);
  const stateCodeFromUrl = stateMatch ? stateMatch[1].toUpperCase() : 'MD'; // Default to Maryland

  // Fetch current tenant info
  const { data, isLoading, error } = useQuery<{ tenant: Tenant; branding?: TenantBranding }>({
    queryKey: ['/api/tenant/current'],
    retry: false, // Don't retry if tenant not found
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch state configuration based on state code
  const { data: stateConfigData, isLoading: stateLoading } = useQuery<StateConfiguration>({
    queryKey: [`/api/state-configurations/code/${stateCodeFromUrl}`],
    enabled: !!stateCodeFromUrl,
    retry: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  useEffect(() => {
    if (error) {
      setTenantError(error as Error);
    }
  }, [error]);

  // Apply state-specific branding if available
  useEffect(() => {
    if (data?.branding) {
      // Apply custom CSS if provided
      if (data.branding.customCss) {
        const styleElement = document.getElementById('tenant-custom-css') || document.createElement('style');
        styleElement.id = 'tenant-custom-css';
        styleElement.textContent = data.branding.customCss;
        if (!document.getElementById('tenant-custom-css')) {
          document.head.appendChild(styleElement);
        }
      }

      // Apply primary and secondary colors to CSS variables
      if (data.branding.primaryColor || data.branding.secondaryColor) {
        const root = document.documentElement;
        if (data.branding.primaryColor) {
          root.style.setProperty('--tenant-primary', data.branding.primaryColor);
        }
        if (data.branding.secondaryColor) {
          root.style.setProperty('--tenant-secondary', data.branding.secondaryColor);
        }
      }

      // Update favicon if provided
      if (data.branding.faviconUrl) {
        const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = data.branding.faviconUrl;
        }
      }
    }

    // Cleanup on unmount
    return () => {
      const styleElement = document.getElementById('tenant-custom-css');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [data?.branding]);

  const value: TenantContextValue = {
    tenant: data?.tenant || null,
    branding: data?.branding || null,
    stateConfig: stateConfigData || null,
    stateCode: stateCodeFromUrl,
    isLoading: isLoading || stateLoading,
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

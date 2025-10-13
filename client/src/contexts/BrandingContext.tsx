import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  headerText?: string;
}

interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
}

interface CountyBranding {
  countyId: string;
  countyName: string;
  countyCode: string;
  brandingConfig: BrandingConfig | null;
  welcomeMessage: string | null;
  contactInfo: ContactInfo | null;
}

interface BrandingContextType {
  branding: CountyBranding | null;
  isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: null,
  isLoading: false,
});

export function useBranding() {
  return useContext(BrandingContext);
}

interface BrandingProviderProps {
  children: ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const { isAuthenticated } = useAuth();
  
  const { data, isLoading } = useQuery<CountyBranding | null>({
    queryKey: ["/api/branding/current"],
    enabled: isAuthenticated, // Only fetch when user is authenticated
  });

  const branding = data ?? null;

  // Apply branding CSS variables when branding data changes
  useEffect(() => {
    const root = document.documentElement;
    
    if (branding?.brandingConfig) {
      const config = branding.brandingConfig;

      // Set or remove primary color
      if (config.primaryColor) {
        root.style.setProperty("--county-primary", config.primaryColor);
      } else {
        root.style.removeProperty("--county-primary");
      }

      // Set or remove secondary color
      if (config.secondaryColor) {
        root.style.setProperty("--county-secondary", config.secondaryColor);
      } else {
        root.style.removeProperty("--county-secondary");
      }
    } else {
      // Reset to default when no branding
      root.style.removeProperty("--county-primary");
      root.style.removeProperty("--county-secondary");
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
}

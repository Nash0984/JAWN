import { useBranding } from "@/contexts/BrandingContext";
import { Building2 } from "lucide-react";
import { TenantSeal } from "./TenantSeal";
import { useTenant } from "@/contexts/TenantContext";

export function CountyHeader() {
  const { branding, isLoading } = useBranding();
  const { stateConfig } = useTenant();

  // Wait for both contexts to load before rendering
  if (isLoading || !branding || !stateConfig) {
    return null;
  }

  // White-label: Detect state-level vs county-level tenant
  const logoUrl = branding.brandingConfig?.logoUrl;
  
  // Check if branding data looks like county-level (contains city/county/baltimore keywords)
  const countyLower = (branding.countyName || '').toLowerCase();
  const headerLower = (branding.brandingConfig?.headerText || '').toLowerCase();
  const looksLikeCountyBranding = 
    countyLower.includes('city') || 
    countyLower.includes('county') ||
    countyLower.includes('baltimore') ||
    headerLower.includes('city') ||
    headerLower.includes('county') ||
    headerLower.includes('baltimore');
  
  // State-level tenant if: branding looks county-level AND state config available
  // This overrides Baltimore City defaults with state-level branding
  const isStateLevelTenant = looksLikeCountyBranding && stateConfig?.stateName;
  
  // Priority: state-level tenant override > custom branding > county name
  const headerText = isStateLevelTenant 
                       ? `${stateConfig.stateName} Department of Human Services`
                       : (branding.brandingConfig?.headerText || branding.countyName);

  return (
    <div 
      className="flex items-center gap-3 px-4 py-2 border-b"
      style={{
        background: `linear-gradient(to right, color-mix(in srgb, var(--county-primary), transparent 90%), color-mix(in srgb, var(--county-secondary), transparent 90%))`,
        borderColor: `color-mix(in srgb, var(--county-primary), transparent 60%)`
      }}
      data-testid="header-county-branding"
    >
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt={`${headerText} Logo`}
          className="h-10 w-10 object-contain"
          data-testid="img-county-logo"
        />
      ) : (isStateLevelTenant || 
             (stateConfig?.stateName && branding.countyName?.toLowerCase().includes(stateConfig.stateName.toLowerCase())) || 
             branding.countyName?.toLowerCase().includes('state') || 
             branding.countyName?.toLowerCase().includes('commonwealth')) ? (
        <TenantSeal
          size="md"
          className="h-10 w-10" 
          data-testid="img-state-seal"
        />
      ) : (
        <Building2 
          className="h-10 w-10" 
          style={{ color: 'var(--county-primary)' }}
          data-testid="icon-county-default"
        />
      )}
      
      <div className="flex-1">
        <h1 
          className="text-lg font-semibold"
          style={{ color: `color-mix(in srgb, var(--county-primary), black 20%)` }}
          data-testid="text-county-name"
        >
          {headerText}
        </h1>
        {isStateLevelTenant ? (
          <p 
            className="text-sm"
            style={{ color: `color-mix(in srgb, var(--county-primary), black 10%)` }}
            data-testid="text-county-welcome"
          >
            Welcome to {stateConfig.stateName} Benefits Navigator
          </p>
        ) : branding.welcomeMessage ? (
          <p 
            className="text-sm"
            style={{ color: `color-mix(in srgb, var(--county-primary), black 10%)` }}
            data-testid="text-county-welcome"
          >
            {branding.welcomeMessage}
          </p>
        ) : null}
      </div>

      {branding.contactInfo?.phone && (
        <div 
          className="hidden md:flex items-center gap-2 text-sm"
          style={{ color: `color-mix(in srgb, var(--county-primary), black 10%)` }}
          data-testid="text-county-contact"
        >
          <span className="font-medium">Contact:</span>
          <a 
            href={`tel:${branding.contactInfo.phone}`}
            className="hover:underline"
            data-testid="link-county-phone"
          >
            {branding.contactInfo.phone}
          </a>
        </div>
      )}
    </div>
  );
}

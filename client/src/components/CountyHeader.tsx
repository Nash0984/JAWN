import { useBranding } from "@/contexts/BrandingContext";
import { Building2 } from "lucide-react";
import { TenantSeal } from "./TenantSeal";
import { useTenant } from "@/contexts/TenantContext";

export function CountyHeader() {
  const { branding, isLoading } = useBranding();
  const { stateConfig } = useTenant();

  if (isLoading || !branding) {
    return null;
  }

  // White-label: Detect state-level vs county-level tenant
  const logoUrl = branding.brandingConfig?.logoUrl;
  
  // State-level tenant if: no custom branding AND countyName indicates county-level (contains city/county keywords)
  // For white-labeling: prefer state-level branding when county appears to be default/demo data
  const countyLower = (branding.countyName || '').toLowerCase();
  const looksLikeCountyLevel = branding.countyName && 
    (countyLower.includes('city') || 
     countyLower.includes('county') ||
     countyLower.includes('baltimore'));
  
  const hasCustomBranding = !!(branding.brandingConfig?.headerText || branding.brandingConfig?.logoUrl);
  const isStateLevelTenant = !hasCustomBranding && looksLikeCountyLevel && stateConfig?.stateName;
  
  const headerText = branding.brandingConfig?.headerText || 
                     (isStateLevelTenant 
                       ? `${stateConfig.stateName} Department of Human Services`
                       : branding.countyName);

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

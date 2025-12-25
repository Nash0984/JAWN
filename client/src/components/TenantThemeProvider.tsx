import { useEffect, ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';

interface TenantThemeProviderProps {
  children: ReactNode;
}

export function TenantThemeProvider({ children }: TenantThemeProviderProps) {
  const { tenant, branding, stateConfig, isLoading } = useTenant();

  useEffect(() => {
    if (isLoading) return;

    const root = document.documentElement;

    // Apply tenant brand colors
    if (branding?.primaryColor) {
      const primaryHsl = hexToHSL(branding.primaryColor);
      root.style.setProperty('--tenant-primary', primaryHsl);
      
      // Calculate hover variant (10% darker)
      const primaryHoverHsl = adjustLightness(primaryHsl, -10);
      root.style.setProperty('--primary-hover', primaryHoverHsl);
    } else {
      // Clear custom primary, use default
      root.style.removeProperty('--tenant-primary');
      root.style.removeProperty('--primary-hover');
    }

    if (branding?.secondaryColor) {
      const secondaryHsl = hexToHSL(branding.secondaryColor);
      root.style.setProperty('--tenant-secondary', secondaryHsl);
      
      // Calculate hover variant
      const secondaryHoverHsl = adjustLightness(secondaryHsl, -5);
      root.style.setProperty('--secondary-hover', secondaryHoverHsl);
    } else {
      root.style.removeProperty('--tenant-secondary');
      root.style.removeProperty('--secondary-hover');
    }

    // Some states might define an accent color, fallback to primary if not
    const accentColor = (branding as any)?.accentColor || branding?.primaryColor;
    if (accentColor) {
      const accentHsl = hexToHSL(accentColor);
      root.style.setProperty('--tenant-accent', accentHsl);
      
      // Calculate subtle accent background (very light)
      const accentSubtle = adjustLightnessAndSaturation(accentHsl, 45, -20);
      root.style.setProperty('--accent-subtle', accentSubtle);
    } else {
      root.style.removeProperty('--tenant-accent');
      root.style.removeProperty('--accent-subtle');
    }

    // Apply custom CSS if provided
    if (branding?.customCss) {
      const styleId = 'tenant-custom-css';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }
      
      styleElement.textContent = branding.customCss;
    } else {
      const styleElement = document.getElementById('tenant-custom-css');
      if (styleElement) {
        styleElement.remove();
      }
    }

    // Update favicon
    if (branding?.faviconUrl) {
      updateFavicon(branding.faviconUrl);
    } else if (stateConfig?.stateCode) {
      // Fallback to state seal if no custom favicon
      const fallbackFavicon = `/assets/${stateConfig.stateCode.toLowerCase()}/favicon.ico`;
      updateFavicon(fallbackFavicon);
    }

    // Update page title with tenant/state name
    const siteName = stateConfig?.stateName || tenant?.name || 'Benefits Navigator';
    const agencyName = stateConfig?.agencyAcronym || '';
    document.title = agencyName 
      ? `${siteName} ${agencyName} - Universal Benefits Portal`
      : `${siteName} - Universal Benefits Portal`;

    // Update meta theme-color for mobile browsers
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = branding?.primaryColor || '#0D4F8B'; // Maryland blue fallback

    // Cleanup function
    return () => {
      const styleElement = document.getElementById('tenant-custom-css');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [tenant, branding, stateConfig, isLoading]);

  // Show modern loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground font-medium">Loading benefits portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Convert hex color to HSL format for CSS variables
 * Returns format: "hue saturation% lightness%"
 */
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 3-character hex codes
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lValue = Math.round(l * 100);

  return `${h} ${s}% ${lValue}%`;
}

/**
 * Adjust the lightness of an HSL color
 * @param hsl - HSL string in format "hue saturation% lightness%"
 * @param adjustment - Lightness adjustment in percentage points (-100 to 100)
 */
function adjustLightness(hsl: string, adjustment: number): string {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return hsl;

  const h = parts[0];
  const s = parts[1];
  let l = parseInt(parts[2].replace('%', ''));

  l = Math.max(0, Math.min(100, l + adjustment));

  return `${h} ${s} ${l}%`;
}

/**
 * Adjust both lightness and saturation
 */
function adjustLightnessAndSaturation(hsl: string, lightnessAdjustment: number, saturationAdjustment: number): string {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return hsl;

  const h = parts[0];
  let s = parseInt(parts[1].replace('%', ''));
  let l = parseInt(parts[2].replace('%', ''));

  s = Math.max(0, Math.min(100, s + saturationAdjustment));
  l = Math.max(0, Math.min(100, l + lightnessAdjustment));

  return `${h} ${s}% ${l}%`;
}

/**
 * Update favicon helper
 */
function updateFavicon(url: string) {
  let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = url;
}

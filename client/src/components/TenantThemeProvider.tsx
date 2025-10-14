import { useEffect, ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';

interface TenantThemeProviderProps {
  children: ReactNode;
}

export function TenantThemeProvider({ children }: TenantThemeProviderProps) {
  const { tenant, branding, isLoading } = useTenant();

  useEffect(() => {
    if (!branding && !tenant) return;

    // Apply primary and secondary colors as CSS custom properties
    const root = document.documentElement;

    if (branding?.primaryColor) {
      root.style.setProperty('--tenant-primary', branding.primaryColor);
      // Also update the primary color for shadcn components
      // Convert hex to HSL for CSS variables
      const primaryHsl = hexToHSL(branding.primaryColor);
      root.style.setProperty('--primary', primaryHsl);
    }

    if (branding?.secondaryColor) {
      root.style.setProperty('--tenant-secondary', branding.secondaryColor);
      const secondaryHsl = hexToHSL(branding.secondaryColor);
      root.style.setProperty('--secondary', secondaryHsl);
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
    }

    // Update favicon if provided
    if (branding?.faviconUrl) {
      let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = branding.faviconUrl;
    }

    // Update page title with tenant name
    if (tenant?.name) {
      document.title = `${tenant.name} - Benefits Portal`;
    }

    // Cleanup function
    return () => {
      // Remove custom styles when tenant changes
      const styleElement = document.getElementById('tenant-custom-css');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [tenant, branding]);

  // Show loading state while tenant is being fetched
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Convert hex color to HSL format for CSS variables
 * Shadcn uses HSL format: "hue saturation lightness"
 */
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');

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

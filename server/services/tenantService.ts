import { storage } from "../storage";
import type { Tenant, TenantBranding, InsertTenant, InsertTenantBranding } from "@shared/schema";

/**
 * Tenant Service
 * Manages multi-tenant operations including tenant detection, creation, and branding
 */

export class TenantService {
  /**
   * Get tenant by ID
   */
  async getTenant(id: string): Promise<Tenant | undefined> {
    return await storage.getTenant(id);
  }

  /**
   * Get tenant by slug (URL identifier)
   */
  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return await storage.getTenantBySlug(slug);
  }

  /**
   * Get tenant by custom domain
   */
  async getTenantByDomain(domain: string): Promise<Tenant | undefined> {
    return await storage.getTenantByDomain(domain);
  }

  /**
   * Detect tenant from request hostname
   * Supports:
   * - Custom domain: benefits.maryland.gov -> maryland
   * - Subdomain: maryland.benefits.app -> maryland
   * - Subdomain with env: maryland.benefits.replit.dev -> maryland
   */
  detectTenantFromHostname(hostname: string): { type: 'domain' | 'subdomain' | 'slug'; value: string } | null {
    // Remove port if present
    const cleanHostname = hostname.split(':')[0];

    // Try custom domain first (exact match in database)
    // This will be checked later against database domains

    // Extract subdomain for multi-tenant routing
    // Examples:
    // - maryland.benefits.app -> subdomain: maryland
    // - maryland.benefits.replit.dev -> subdomain: maryland
    // - localhost -> no subdomain (use default or query param)
    
    const parts = cleanHostname.split('.');
    
    // If localhost or IP, no subdomain detection
    if (cleanHostname === 'localhost' || cleanHostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      return null;
    }

    // For replit.dev domains: maryland.something.replit.dev
    if (cleanHostname.includes('.replit.dev')) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www') {
        return { type: 'subdomain', value: subdomain };
      }
      return null;
    }

    // For custom domains with 3+ parts: subdomain.domain.tld
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www') {
        return { type: 'subdomain', value: subdomain };
      }
    }

    // For 2-part domains, check if it's a custom domain
    if (parts.length === 2) {
      return { type: 'domain', value: cleanHostname };
    }

    return null;
  }

  /**
   * Get tenant from hostname or query param
   */
  async getTenantFromRequest(hostname: string, queryTenant?: string): Promise<Tenant | undefined> {
    // Priority 1: Explicit tenant query param (for testing/debugging)
    if (queryTenant) {
      const tenant = await this.getTenantBySlug(queryTenant);
      if (tenant) return tenant;
    }

    // Priority 2: Detect from hostname
    const detected = this.detectTenantFromHostname(hostname);
    
    if (detected) {
      // Try custom domain first
      if (detected.type === 'domain') {
        const byDomain = await this.getTenantByDomain(detected.value);
        if (byDomain) return byDomain;
      }

      // Try subdomain as slug
      if (detected.type === 'subdomain' || detected.type === 'slug') {
        const bySlug = await this.getTenantBySlug(detected.value);
        if (bySlug) return bySlug;
      }
    }

    // No tenant found
    return undefined;
  }

  /**
   * Get all tenants with optional filters
   */
  async getTenants(filters?: { type?: string; status?: string; parentTenantId?: string }): Promise<Tenant[]> {
    return await storage.getTenants(filters);
  }

  /**
   * Create new tenant
   */
  async createTenant(data: InsertTenant): Promise<Tenant> {
    return await storage.createTenant(data);
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    return await storage.updateTenant(id, updates);
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string): Promise<void> {
    await storage.deleteTenant(id);
  }

  /**
   * Get tenant branding
   */
  async getTenantBranding(tenantId: string): Promise<TenantBranding | undefined> {
    return await storage.getTenantBranding(tenantId);
  }

  /**
   * Create tenant branding
   */
  async createTenantBranding(branding: InsertTenantBranding): Promise<TenantBranding> {
    return await storage.createTenantBranding(branding);
  }

  /**
   * Update tenant branding
   */
  async updateTenantBranding(tenantId: string, updates: Partial<TenantBranding>): Promise<TenantBranding> {
    return await storage.updateTenantBranding(tenantId, updates);
  }

  /**
   * Delete tenant branding
   */
  async deleteTenantBranding(tenantId: string): Promise<void> {
    await storage.deleteTenantBranding(tenantId);
  }

  /**
   * Get tenant configuration with branding
   */
  async getTenantConfig(tenantId: string): Promise<{ tenant: Tenant; branding?: TenantBranding } | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return null;

    const branding = await this.getTenantBranding(tenantId);
    
    return {
      tenant,
      branding,
    };
  }

  /**
   * Validate tenant is active and accessible
   */
  validateTenantAccess(tenant: Tenant | undefined): { valid: boolean; error?: string } {
    if (!tenant) {
      return { valid: false, error: 'Tenant not found' };
    }

    if (tenant.status === 'inactive') {
      return { valid: false, error: 'This tenant is currently inactive' };
    }

    return { valid: true };
  }
}

export const tenantService = new TenantService();

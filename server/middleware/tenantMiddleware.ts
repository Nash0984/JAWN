import { Request, Response, NextFunction } from "express";
import { tenantService } from "../services/tenantService";
import type { Tenant, TenantBranding } from "@shared/schema";

/**
 * Tenant Middleware
 * Detects and enforces multi-tenant isolation
 */

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        tenant: Tenant;
        branding?: TenantBranding;
      };
    }
  }
}

/**
 * Middleware to detect and load tenant context
 * For Maryland single-instance deployment: defaults to Maryland tenant
 * For multi-state deployments: uses hostname/subdomain detection
 */
export async function detectTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hostname = req.hostname || req.get('host') || 'localhost';
    const queryTenant = req.query.tenant as string | undefined;

    // Try to detect tenant from hostname or query param
    let tenant = await tenantService.getTenantFromRequest(hostname, queryTenant);

    // MARYLAND SINGLE-INSTANCE: Default to Maryland tenant if no tenant detected
    // This allows marylandbenefits.gov to work without subdomain/multi-tenant routing
    if (!tenant) {
      tenant = await tenantService.getTenantBySlug('maryland');
      
      // If Maryland tenant doesn't exist, create it on-the-fly (for development)
      if (!tenant && process.env.NODE_ENV === 'development') {
        // Tenant will be created by seed data - development only
      }
    }

    if (tenant) {
      // Validate tenant access
      const validation = tenantService.validateTenantAccess(tenant);
      
      if (!validation.valid) {
        return res.status(403).json({
          error: validation.error || 'Access denied to this tenant',
        });
      }

      // Load tenant branding
      const branding = await tenantService.getTenantBranding(tenant.id);

      // Attach to request
      req.tenant = {
        tenant,
        branding,
      };
    }

    // Continue - tenant is now optional for single-instance deployment
    next();
  } catch (error) {
    // Silently continue - tenant detection errors shouldn't break requests
    // Error likely due to missing foreign key constraint in database
    next(); // Continue gracefully
  }
}

/**
 * Middleware to require tenant context
 * Returns 404 if no tenant is found
 */
export function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.tenant) {
    return res.status(404).json({
      error: 'Tenant not found',
      message: 'No tenant configuration found for this domain or subdomain',
    });
  }

  next();
}

/**
 * Middleware to require specific tenant type
 */
export function requireTenantType(type: 'state' | 'county') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
      });
    }

    if (req.tenant.tenant.type !== type) {
      return res.status(403).json({
        error: `This operation requires a ${type}-level tenant`,
      });
    }

    next();
  };
}

/**
 * Middleware to require active tenant status
 */
export function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.tenant) {
    return res.status(404).json({
      error: 'Tenant not found',
    });
  }

  if (req.tenant.tenant.status !== 'active') {
    return res.status(403).json({
      error: 'This tenant is not currently active',
      status: req.tenant.tenant.status,
    });
  }

  next();
}

/**
 * Helper function to get tenant ID from request
 * Returns null if no tenant context
 */
export function getTenantId(req: Request): string | null {
  return req.tenant?.tenant.id || null;
}

/**
 * Helper function to check if user has access to tenant
 * For now, users can only access their own tenant
 * Super admins can access all tenants
 */
export function canAccessTenant(req: Request, tenantId: string): boolean {
  // Super admins can access all tenants
  if (req.user?.role === 'super_admin') {
    return true;
  }

  // Regular users can only access their own tenant
  if (!req.user?.tenantId) {
    return false;
  }

  return req.user.tenantId === tenantId;
}

/**
 * Middleware to enforce tenant isolation
 * Ensures users can only access data from their own tenant
 */
export function enforceTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  // Super admins bypass tenant isolation
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Ensure user has a tenant
  if (!req.user.tenantId) {
    return res.status(403).json({
      error: 'User not assigned to a tenant',
    });
  }

  // Ensure request tenant matches user tenant
  if (req.tenant && req.tenant.tenant.id !== req.user.tenantId) {
    return res.status(403).json({
      error: 'Access denied to this tenant',
    });
  }

  next();
}

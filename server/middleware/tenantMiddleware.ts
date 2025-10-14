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
 * Adds tenant info to request object for use in route handlers
 */
export async function detectTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hostname = req.hostname || req.get('host') || 'localhost';
    const queryTenant = req.query.tenant as string | undefined;

    // Detect and load tenant
    const tenant = await tenantService.getTenantFromRequest(hostname, queryTenant);

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

    // Continue even if no tenant found (some routes may not require tenant)
    next();
  } catch (error) {
    console.error('Error detecting tenant context:', error);
    next(); // Continue even if tenant detection fails
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

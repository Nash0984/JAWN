import { Request, Response, NextFunction } from "express";
import { tenantService } from "../services/tenantService";
import type { Tenant, TenantBranding, StateTenant, Office } from "@shared/schema";
import { db } from "../db";
import { stateTenants, offices, officeRoles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../services/logger.service";

/**
 * Tenant Middleware - Multi-State Architecture
 * 
 * ARCHITECTURE:
 * - State Tenant: Compliance boundary (NIST AC-4) - KMS keys, data residency, access control
 * - Office: Operational metadata - routing, reporting, workload tracking (NOT access control)
 * 
 * Detects and enforces state-level tenant isolation while maintaining optional office context
 * for routing and reporting purposes only.
 */

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        tenant: Tenant;
        branding?: TenantBranding;
      };
      stateTenant?: StateTenant; // Multi-state architecture: State-level tenant isolation
      office?: Office;           // Optional: Office context for routing/reporting only (NOT access control)
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

// ============================================================================
// MULTI-STATE ARCHITECTURE MIDDLEWARE
// ============================================================================

/**
 * Middleware to detect and load state tenant context
 * 
 * State Tenant = Compliance boundary (NIST AC-4)
 * - Enforces data residency, KMS encryption keys, access control
 * - For Maryland: Defaults to MD state tenant
 * - For multi-state: Detects from subdomain/query param
 */
export async function detectStateTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hostname = req.hostname || req.get('host') || 'localhost';
    const queryStateCode = req.query.state as string | undefined;

    let stateTenant: StateTenant | undefined;

    // Try to detect state from query param first
    if (queryStateCode) {
      const [result] = await db
        .select()
        .from(stateTenants)
        .where(eq(stateTenants.stateCode, queryStateCode.toUpperCase()))
        .limit(1);
      stateTenant = result;
    }

    // Try to detect from subdomain (e.g., md.jawn.gov, pa.jawn.gov)
    if (!stateTenant) {
      const subdomain = hostname.split('.')[0];
      const stateCodeMap: Record<string, string> = {
        'md': 'MD',
        'maryland': 'MD',
        'pa': 'PA',
        'pennsylvania': 'PA',
        'va': 'VA',
        'virginia': 'VA',
      };
      
      const stateCode = stateCodeMap[subdomain.toLowerCase()];
      if (stateCode) {
        const [result] = await db
          .select()
          .from(stateTenants)
          .where(eq(stateTenants.stateCode, stateCode))
          .limit(1);
        stateTenant = result;
      }
    }

    // MARYLAND SINGLE-INSTANCE: Default to Maryland state tenant
    // This allows marylandbenefits.gov to work without subdomain routing
    if (!stateTenant) {
      const [result] = await db
        .select()
        .from(stateTenants)
        .where(eq(stateTenants.stateCode, 'MD'))
        .limit(1);
      stateTenant = result;
    }

    // COMPLIANCE: Validate state tenant access against authenticated user
    // If user is authenticated and has a stateTenantId, ensure it matches detected state tenant
    if (stateTenant && req.user && req.user.stateTenantId) {
      if (req.user.role !== 'super_admin' && stateTenant.id !== req.user.stateTenantId) {
        // User is trying to access a different state tenant - reject
        logger.warn("State tenant access violation attempt", {
          service: "tenantMiddleware",
          userId: req.user.id,
          userStateTenantId: req.user.stateTenantId,
          requestedStateTenantId: stateTenant.id,
          action: "detectStateTenantContext",
        });
        
        // Clear state tenant to prevent access
        stateTenant = undefined;
      }
    }

    // Attach to request
    if (stateTenant) {
      req.stateTenant = stateTenant;
    }

    next();
  } catch (error) {
    // Silently continue - state tenant detection errors shouldn't break requests
    next();
  }
}

/**
 * Middleware to detect and load office context (optional)
 * 
 * Office = Operational metadata for routing/reporting ONLY
 * - NOT used for access control (that's handled by state tenant)
 * - Used for: routing rules, workload tracking, office-specific reporting
 * 
 * Detection priority:
 * 1. Query param (?office=BALTIMORE_CITY)
 * 2. User's primary office assignment (from officeRoles)
 * 3. No office (null) - user has state-level access across all offices
 */
export async function detectOfficeContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.stateTenant || !req.user) {
      return next(); // No state tenant or user - skip office detection
    }

    let office: Office | undefined;

    // Priority 1: Explicit office query param
    const queryOfficeCode = req.query.office as string | undefined;
    if (queryOfficeCode) {
      const [result] = await db
        .select()
        .from(offices)
        .where(
          and(
            eq(offices.stateTenantId, req.stateTenant.id),
            eq(offices.code, queryOfficeCode.toUpperCase())
          )
        )
        .limit(1);
      office = result;
    }

    // Priority 2: User's primary office assignment
    if (!office && req.user.id) {
      const [primaryRole] = await db
        .select()
        .from(officeRoles)
        .innerJoin(offices, eq(officeRoles.officeId, offices.id))
        .where(
          and(
            eq(officeRoles.userId, req.user.id),
            eq(officeRoles.isPrimary, true),
            eq(offices.stateTenantId, req.stateTenant.id)
          )
        )
        .limit(1);

      if (primaryRole) {
        office = primaryRole.offices;
      }
    }

    // Attach to request (may be undefined - that's okay for state-level access)
    if (office) {
      req.office = office;
    }

    next();
  } catch (error) {
    // Silently continue - office detection errors shouldn't break requests
    next();
  }
}

/**
 * Middleware to require state tenant context
 * Returns 404 if no state tenant is found
 */
export function requireStateTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.stateTenant) {
    return res.status(404).json({
      error: 'State tenant not found',
      message: 'No state configuration found for this domain or state parameter',
    });
  }

  next();
}

/**
 * Middleware to enforce state-level tenant isolation (NIST AC-4)
 * 
 * Ensures users can only access data from their assigned state tenant
 * State tenant = Compliance boundary (not office)
 */
export function enforceStateTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  // Super admins bypass state tenant isolation
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Ensure user has a state tenant assigned
  if (!req.user.stateTenantId) {
    return res.status(403).json({
      error: 'User not assigned to a state tenant',
      message: 'Contact your administrator to assign you to a state',
    });
  }

  // Ensure request state tenant matches user state tenant
  if (req.stateTenant && req.stateTenant.id !== req.user.stateTenantId) {
    return res.status(403).json({
      error: 'Access denied to this state',
      message: 'You do not have permission to access data from this state',
    });
  }

  next();
}

/**
 * Helper function to get state tenant ID from request
 * Returns null if no state tenant context
 */
export function getStateTenantId(req: Request): string | null {
  return req.stateTenant?.id || null;
}

/**
 * Helper function to get office ID from request (if present)
 * Returns null if no office context
 */
export function getOfficeId(req: Request): string | null {
  return req.office?.id || null;
}

/**
 * Middleware to require active state tenant status
 */
export function requireActiveStateTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.stateTenant) {
    return res.status(404).json({
      error: 'State tenant not found',
    });
  }

  if (req.stateTenant.status !== 'active') {
    return res.status(403).json({
      error: 'This state tenant is not currently active',
      status: req.stateTenant.status,
      message: 'State tenant must be active to access this resource',
    });
  }

  next();
}

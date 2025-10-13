import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/**
 * County Context Middleware
 * Detects and enforces county-based tenant isolation
 */

declare global {
  namespace Express {
    interface Request {
      countyContext?: {
        countyId: string;
        countyName: string;
        isMultiCounty: boolean; // True if user has access to multiple counties
        allCountyIds: string[]; // All counties user has access to
      };
    }
  }
}

/**
 * Middleware to detect user's county context
 * Adds countyContext to request object for use in route handlers
 */
export async function detectCountyContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip if no authenticated user
    if (!req.user || !req.user.id) {
      return next();
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins have access to all counties
    if (userRole === 'admin') {
      req.countyContext = {
        countyId: '', // Admin can see all
        countyName: 'All Counties',
        isMultiCounty: true,
        allCountyIds: [], // Will be populated if needed
      };
      return next();
    }

    // Get user's county assignments
    const userCounties = await storage.getUserCounties(userId);

    if (userCounties.length === 0) {
      // User not assigned to any county
      req.countyContext = {
        countyId: '',
        countyName: 'No County',
        isMultiCounty: false,
        allCountyIds: [],
      };
      return next();
    }

    // Get county details for primary assignment
    const primaryCounty = userCounties[0];
    const county = await storage.getCounty(primaryCounty.countyId);

    req.countyContext = {
      countyId: primaryCounty.countyId,
      countyName: county?.name || 'Unknown County',
      isMultiCounty: userCounties.length > 1,
      allCountyIds: userCounties.map(uc => uc.countyId),
    };

    next();
  } catch (error) {
    console.error('Error detecting county context:', error);
    next(); // Continue even if county detection fails
  }
}

/**
 * Middleware to enforce single-county access
 * Requires user to be assigned to exactly one county
 */
export function requireSingleCounty(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.countyContext) {
    return res.status(500).json({ 
      error: "County context not initialized. Ensure detectCountyContext middleware is applied first." 
    });
  }

  if (!req.countyContext.countyId) {
    return res.status(403).json({ 
      error: "You must be assigned to a county to access this resource" 
    });
  }

  if (req.countyContext.isMultiCounty) {
    return res.status(400).json({ 
      error: "This operation requires a single county context. Please specify a county." 
    });
  }

  next();
}

/**
 * Middleware to require county assignment
 * User must be assigned to at least one county
 */
export function requireCountyAssignment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.countyContext) {
    return res.status(500).json({ 
      error: "County context not initialized" 
    });
  }

  if (!req.countyContext.countyId && req.user?.role !== 'admin') {
    return res.status(403).json({ 
      error: "You must be assigned to a county to access this resource" 
    });
  }

  next();
}

/**
 * Middleware to validate county access
 * Checks if user has access to a specific county (from query/params)
 */
export function validateCountyAccess(paramName: string = 'countyId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.countyContext) {
      return res.status(500).json({ 
        error: "County context not initialized" 
      });
    }

    // Admins can access any county
    if (req.user?.role === 'admin') {
      return next();
    }

    // Get requested county ID from params or query
    const requestedCountyId = req.params[paramName] || req.query[paramName];

    if (!requestedCountyId) {
      return next(); // No county specified, continue
    }

    // Check if user has access to requested county
    if (!req.countyContext.allCountyIds.includes(requestedCountyId as string)) {
      return res.status(403).json({ 
        error: "You do not have access to this county" 
      });
    }

    next();
  };
}

/**
 * Helper function to filter query by county context
 * Returns countyId(s) to use in database queries
 * Returns null only for admins (access all counties)
 * Returns empty array for users with no assignments (access nothing)
 */
export function getCountyFilter(req: Request): string[] | null {
  if (!req.countyContext) {
    return []; // No context = no access
  }

  // Admins see all counties (no filter = null)
  if (req.user?.role === 'admin') {
    return null;
  }

  // Return user's counties for filtering
  // Empty array means user has no counties = no access to any data
  return req.countyContext.allCountyIds;
}

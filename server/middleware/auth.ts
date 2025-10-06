import { Request, Response, NextFunction } from "express";
import type { User as AppUser } from "../../shared/schema";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

// Local type alias for convenience
type User = AppUser;

/**
 * Middleware to ensure user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in to access this resource" 
    });
  }
  next();
}

/**
 * Middleware to ensure user has one of the required roles
 * Usage: requireRole('admin') or requireRole('navigator', 'caseworker')
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ 
        error: "Authentication required",
        message: "Please log in to access this resource" 
      });
    }

    const user = req.user as User;
    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        message: `This resource requires one of the following roles: ${roles.join(", ")}`,
        requiredRoles: roles,
        userRole: user.role
      });
    }

    next();
  };
}

/**
 * Middleware to check if user is a Maryland DHS staff member (navigator or caseworker)
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in to access this resource" 
    });
  }

  const user = req.user as User;
  if (!['navigator', 'caseworker', 'admin'].includes(user.role)) {
    return res.status(403).json({ 
      error: "Staff access required",
      message: "This resource is only accessible to Maryland DHS staff members",
      userRole: user.role
    });
  }

  next();
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in to access this resource" 
    });
  }

  const user = req.user as User;
  if (user.role !== 'admin') {
    return res.status(403).json({ 
      error: "Admin access required",
      message: "This resource is only accessible to administrators",
      userRole: user.role
    });
  }

  next();
}

/**
 * Middleware to check if user account is active
 */
export function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ 
      error: "Authentication required",
      message: "Please log in to access this resource" 
    });
  }

  const user = req.user as User;
  if (!user.isActive) {
    return res.status(403).json({ 
      error: "Account inactive",
      message: "Your account has been deactivated. Please contact support for assistance."
    });
  }

  next();
}

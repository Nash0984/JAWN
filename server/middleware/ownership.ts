/**
 * Ownership Verification Middleware
 * 
 * Ensures users can only access their own data.
 * Admins and staff may have elevated permissions based on role.
 * 
 * Security Pattern:
 * 1. Extract resource ID from request
 * 2. Fetch resource from database
 * 3. Verify user owns the resource (userId match)
 * 4. Allow admins/staff override if permitted
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { notifications } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authorizationError, notFoundError } from "./errorHandler";

export interface OwnershipCheckOptions {
  /**
   * Allow admin users to access any resource
   */
  allowAdmin?: boolean;
  
  /**
   * Allow staff users to access any resource
   */
  allowStaff?: boolean;
  
  /**
   * Custom error message when ownership fails
   */
  errorMessage?: string;
  
  /**
   * Field name for user ID in the resource (default: 'userId')
   */
  userIdField?: string;
}

/**
 * Create ownership verification middleware for household profiles
 */
export function verifyHouseholdProfileOwnership(options: OwnershipCheckOptions = {}) {
  const {
    allowAdmin = true,
    allowStaff = false, // SECURITY: Staff should not bypass ownership checks by default
    errorMessage = "You do not have permission to access this household profile",
    userIdField = "userId"
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profileId = req.params.id || req.params.profileId;
      const userId = (req as any).userId || req.user?.id;
      
      if (!userId) {
        throw authorizationError("User not authenticated");
      }
      
      if (!profileId) {
        throw notFoundError("Household profile ID not provided");
      }
      
      // Check if user is admin or staff and allowed
      const user = await storage.getUser(userId);
      if (user) {
        if (allowAdmin && user.role === 'admin') {
          return next();
        }
        if (allowStaff && (user.role === 'staff' || user.role === 'navigator' || user.role === 'caseworker')) {
          return next();
        }
      }
      
      // Fetch household profile
      const profile = await storage.getHouseholdProfile(profileId);
      
      if (!profile) {
        throw notFoundError("Household profile not found");
      }
      
      // Verify ownership
      const ownerId = (profile as any)[userIdField];
      if (ownerId !== userId) {
        throw authorizationError(errorMessage);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create ownership verification middleware for VITA intake sessions
 */
export function verifyVitaSessionOwnership(options: OwnershipCheckOptions = {}) {
  const {
    allowAdmin = true,
    allowStaff = false, // SECURITY: Staff should not bypass ownership checks by default
    errorMessage = "You do not have permission to access this VITA intake session",
    userIdField = "createdBy"
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.id || req.params.sessionId;
      const userId = (req as any).userId || req.user?.id;
      
      if (!userId) {
        throw authorizationError("User not authenticated");
      }
      
      if (!sessionId) {
        throw notFoundError("VITA session ID not provided");
      }
      
      // Check if user is admin or staff and allowed
      const user = await storage.getUser(userId);
      if (user) {
        if (allowAdmin && user.role === 'admin') {
          return next();
        }
        if (allowStaff && (user.role === 'staff' || user.role === 'navigator' || user.role === 'caseworker')) {
          return next();
        }
      }
      
      // Fetch VITA session
      const session = await storage.getVitaIntakeSession(sessionId);
      
      if (!session) {
        throw notFoundError("VITA intake session not found");
      }
      
      // Verify ownership
      const ownerId = (session as any)[userIdField];
      if (ownerId !== userId) {
        throw authorizationError(errorMessage);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create ownership verification middleware for tax documents
 */
export function verifyTaxDocumentOwnership(options: OwnershipCheckOptions = {}) {
  const {
    allowAdmin = true,
    allowStaff = false, // SECURITY: Staff should not bypass ownership checks by default
    errorMessage = "You do not have permission to access this tax document",
    userIdField = "uploadedBy"
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = req.params.id || req.params.documentId;
      const userId = (req as any).userId || req.user?.id;
      
      if (!userId) {
        throw authorizationError("User not authenticated");
      }
      
      if (!documentId) {
        throw notFoundError("Tax document ID not provided");
      }
      
      // Check if user is admin or staff and allowed
      const user = await storage.getUser(userId);
      if (user) {
        if (allowAdmin && user.role === 'admin') {
          return next();
        }
        if (allowStaff && (user.role === 'staff' || user.role === 'navigator' || user.role === 'caseworker')) {
          return next();
        }
      }
      
      // Fetch tax document
      const document = await storage.getTaxDocument(documentId);
      
      if (!document) {
        throw notFoundError("Tax document not found");
      }
      
      // Verify ownership
      const ownerId = (document as any)[userIdField];
      if (ownerId !== userId) {
        throw authorizationError(errorMessage);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create ownership verification middleware for notifications
 */
export function verifyNotificationOwnership(options: OwnershipCheckOptions = {}) {
  const {
    allowAdmin = false, // Notifications are personal - even admins shouldn't access others'
    allowStaff = false,
    errorMessage = "You do not have permission to access this notification",
    userIdField = "userId"
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = req.params.id || req.params.notificationId;
      const userId = (req as any).userId || req.user?.id;
      
      if (!userId) {
        throw authorizationError("User not authenticated");
      }
      
      if (!notificationId) {
        throw notFoundError("Notification ID not provided");
      }
      
      // Check if user is admin or staff and allowed (usually not for notifications)
      if (allowAdmin || allowStaff) {
        const user = await storage.getUser(userId);
        if (user) {
          if (allowAdmin && user.role === 'admin') {
            return next();
          }
          if (allowStaff && (user.role === 'staff' || user.role === 'navigator' || user.role === 'caseworker')) {
            return next();
          }
        }
      }
      
      // Fetch notification directly from database
      const [notification] = await db.select().from(notifications).where(eq(notifications.id, notificationId));
      
      if (!notification) {
        throw notFoundError("Notification not found");
      }
      
      // Verify ownership
      const ownerId = (notification as any)[userIdField];
      if (ownerId !== userId) {
        throw authorizationError(errorMessage);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Generic ownership verification middleware factory
 */
export function verifyOwnership<T>(
  fetchFunction: (id: string) => Promise<T | null>,
  options: OwnershipCheckOptions & {
    resourceName: string;
    idParam?: string;
  }
) {
  const {
    allowAdmin = true,
    allowStaff = false, // SECURITY: Staff should not bypass ownership checks by default
    errorMessage,
    userIdField = "userId",
    resourceName,
    idParam = "id"
  } = options;
  
  const defaultErrorMessage = `You do not have permission to access this ${resourceName}`;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params[idParam];
      const userId = (req as any).userId || req.user?.id;
      
      if (!userId) {
        throw authorizationError("User not authenticated");
      }
      
      if (!resourceId) {
        throw notFoundError(`${resourceName} ID not provided`);
      }
      
      // Check if user is admin or staff and allowed
      const user = await storage.getUser(userId);
      if (user) {
        if (allowAdmin && user.role === 'admin') {
          return next();
        }
        if (allowStaff && (user.role === 'staff' || user.role === 'navigator' || user.role === 'caseworker')) {
          return next();
        }
      }
      
      // Fetch resource
      const resource = await fetchFunction(resourceId);
      
      if (!resource) {
        throw notFoundError(`${resourceName} not found`);
      }
      
      // Verify ownership
      const ownerId = (resource as any)[userIdField];
      if (ownerId !== userId) {
        throw authorizationError(errorMessage || defaultErrorMessage);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

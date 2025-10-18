import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { translationAssignments, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function requireTranslationAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Admin/super_admin bypass
  if (user.role === 'admin' || user.role === 'super_admin') {
    return next();
  }
  
  // Check if user is translator or reviewer
  if (user.role !== 'translator' && user.role !== 'reviewer') {
    return res.status(403).json({ error: "Forbidden - requires translator or reviewer role" });
  }
  
  next();
}

export async function requireAssignmentOrAdmin(keyId: string, userId: string, requiredRole?: 'translator' | 'reviewer'): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;
  
  // Admin bypass
  if (user.role === 'admin' || user.role === 'super_admin') {
    return true;
  }
  
  // Check assignment
  const conditions = [
    eq(translationAssignments.keyId, keyId),
    eq(translationAssignments.userId, userId),
    eq(translationAssignments.status, 'active')
  ];
  
  if (requiredRole) {
    conditions.push(eq(translationAssignments.role, requiredRole));
  }
  
  const assignment = await db.query.translationAssignments.findFirst({
    where: and(...conditions)
  });
  
  return !!assignment;
}

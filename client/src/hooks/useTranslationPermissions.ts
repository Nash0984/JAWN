import { useAuth } from '@/hooks/useAuth';

export interface TranslationPermissions {
  canViewTranslations: boolean;
  canEditTranslations: boolean;
  canReviewTranslations: boolean;
  canManageAssignments: boolean;
  canRollbackVersions: boolean;
  canConfigureABTests: boolean;
}

export function useTranslationPermissions(): TranslationPermissions {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) {
    return {
      canViewTranslations: false,
      canEditTranslations: false,
      canReviewTranslations: false,
      canManageAssignments: false,
      canRollbackVersions: false,
      canConfigureABTests: false,
    };
  }
  
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isTranslator = user.role === 'translator' || isAdmin;
  const isReviewer = user.role === 'reviewer' || isAdmin;
  
  return {
    canViewTranslations: isTranslator || isReviewer,
    canEditTranslations: isTranslator,
    canReviewTranslations: isReviewer,
    canManageAssignments: isAdmin,
    canRollbackVersions: isAdmin,
    canConfigureABTests: isAdmin,
  };
}

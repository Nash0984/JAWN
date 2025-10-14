/**
 * QC Analytics Constants
 * Shared constants for Quality Control dashboards and analytics
 */

/**
 * PTIG-compliant error category labels
 * These 6 categories are mandated for Maryland SNAP Quality Control
 */
export const ERROR_CATEGORY_LABELS: Record<string, string> = {
  shelter_utility: "Shelter & Utility Errors",
  income_verification: "Income Verification Errors",
  asset_verification: "Asset Verification Errors",
  categorical_eligibility: "Categorical Eligibility Errors",
  earned_income: "Earned Income Errors",
  unearned_income: "Unearned Income Errors",
};

/**
 * Error category keys type
 */
export type ErrorCategory = keyof typeof ERROR_CATEGORY_LABELS;

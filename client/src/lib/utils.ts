import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a monetary amount from cents to dollars with proper locale formatting
 * @param cents - The amount in cents (e.g., 29100 cents)
 * @param options - Optional Intl.NumberFormatOptions to customize formatting
 * @returns Formatted currency string (e.g., "$291.00")
 */
export function formatCurrency(cents: number, options?: Intl.NumberFormatOptions): string {
  // Convert cents to dollars
  const dollars = cents / 100;
  
  // Use Intl.NumberFormat for proper locale-aware formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }).format(dollars);
}

/**
 * Formats a monetary amount with monthly period indicator
 * @param cents - The amount in cents
 * @returns Formatted string (e.g., "$291/mo")
 */
export function formatMonthlyAmount(cents: number): string {
  return `${formatCurrency(cents)}/mo`;
}

/**
 * Formats a monetary amount with yearly period indicator
 * @param cents - The amount in cents
 * @returns Formatted string (e.g., "$3,492/yr")
 */
export function formatYearlyAmount(cents: number): string {
  return `${formatCurrency(cents)}/yr`;
}

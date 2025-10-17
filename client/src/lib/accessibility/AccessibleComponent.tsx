/**
 * Accessible Component Base
 * 
 * Provides reusable accessible components that enforce WCAG AAA standards:
 * - 44px minimum touch targets
 * - Proper ARIA labels and roles
 * - Keyboard navigation support
 * - Focus management
 * - High contrast mode support (7:1 ratio)
 * - Screen reader announcements
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessible Button - Enforces 44px minimum touch target
 */
export interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
  loading?: boolean;
  iconOnly?: boolean;
}

export function AccessibleButton({
  children,
  ariaLabel,
  loading = false,
  iconOnly = false,
  className,
  disabled,
  ...props
}: AccessibleButtonProps) {
  return (
    <button
      className={cn(
        'min-h-[44px] min-w-[44px]',
        'px-4 py-2',
        'rounded-md font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'transition-colors',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        iconOnly && 'p-2',
        className
      )}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="sr-only">Loading...</span>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  );
}

/**
 * Accessible Input - With proper labeling and error handling
 */
export interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function AccessibleInput({
  label,
  error,
  hint,
  required,
  id,
  className,
  ...props
}: AccessibleInputProps) {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>
      
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      
      <input
        id={inputId}
        className={cn(
          'min-h-[44px] w-full px-3 py-2',
          'border border-input rounded-md',
          'bg-background text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={cn(hint && hintId, error && errorId)}
        aria-required={required}
        {...props}
      />
      
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Screen Reader Announcement - For dynamic content changes
 */
export interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export function LiveRegion({ message, politeness = 'polite' }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Focus Trap for Modals - Keeps focus within modal
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
    
    container.addEventListener('keydown', handleTab);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [isActive]);
  
  return containerRef;
}

/**
 * Accessible Modal with Focus Trap
 */
export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  description?: string;
}

export function AccessibleModal({ isOpen, onClose, title, children, description }: AccessibleModalProps) {
  const focusTrapRef = useFocusTrap(isOpen);
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      setAnnouncement(`${title} dialog opened`);
    }
  }, [isOpen, title]);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <>
      <LiveRegion message={announcement} politeness="assertive" />
      
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-background p-6 shadow-lg rounded-lg border"
      >
        <h2 id="modal-title" className="text-xl font-semibold mb-4">
          {title}
        </h2>
        
        {description && (
          <p id="modal-description" className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        
        <div className="mb-4">
          {children}
        </div>
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 min-h-[44px] min-w-[44px] p-2 rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close dialog"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}

/**
 * Accessible Card with keyboard navigation
 */
export interface AccessibleCardProps {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function AccessibleCard({ title, children, onClick, className }: AccessibleCardProps) {
  const isInteractive = !!onClick;
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick();
    }
  };
  
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6',
        isInteractive && 'cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyPress={isInteractive ? handleKeyPress : undefined}
      aria-label={isInteractive ? title : undefined}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Skip Link for keyboard navigation
 */
export function SkipLink({ href = '#main-content', children = 'Skip to main content' }: { href?: string; children?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
    >
      {children}
    </a>
  );
}

/**
 * High Contrast Check - Detects if user prefers high contrast
 */
export function useHighContrast() {
  const [isHighContrast, setIsHighContrast] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return isHighContrast;
}

/**
 * Reduced Motion Check - Detects if user prefers reduced motion
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReducedMotion;
}

/**
 * Accessible Table with responsive card layout on mobile
 */
export interface AccessibleTableProps {
  headers: string[];
  data: Array<Record<string, any>>;
  caption: string;
}

export function AccessibleTable({ headers, data, caption }: AccessibleTableProps) {
  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b">
              {headers.map((header, i) => (
                <th key={i} scope="col" className="px-4 py-3 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b">
                {headers.map((header, j) => (
                  <td key={j} className="px-4 py-3">
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mobile card view */}
      <div className="md:hidden space-y-4">
        {data.map((row, i) => (
          <div key={i} className="border rounded-lg p-4">
            {headers.map((header, j) => (
              <div key={j} className="flex justify-between py-2 border-b last:border-0">
                <span className="font-semibold">{header}:</span>
                <span>{row[header]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

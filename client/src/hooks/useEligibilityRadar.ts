import { useState, useEffect, useRef, useCallback } from 'react';

export interface HouseholdData {
  adults?: number;
  children?: number;
  elderlyOrDisabled?: boolean;
  employmentIncome?: number;
  unearnedIncome?: number;
  selfEmploymentIncome?: number;
  householdAssets?: number;
  rentOrMortgage?: number;
  utilityCosts?: number;
  medicalExpenses?: number;
  childcareExpenses?: number;
  filingStatus?: 'single' | 'married_joint' | 'married_separate' | 'head_of_household' | 'qualifying_widow';
  wageWithholding?: number;
  stateCode?: string;
  year?: number;
}

export interface ProgramEligibility {
  id: string;
  name: string;
  status: 'eligible' | 'ineligible' | 'needs_info';
  monthlyAmount?: number;
  annualAmount?: number;
  eligible?: boolean;
  change?: number | string;
  changePercent?: number;
}

export interface Alert {
  type: 'success' | 'warning' | 'opportunity' | 'info';
  program: string;
  message: string;
  action?: string;
  estimatedIncrease?: number;
}

export interface EligibilitySummary {
  totalMonthlyBenefits: number;
  totalAnnualBenefits: number;
  eligibleProgramCount: number;
  householdNetIncome: number;
  effectiveBenefitRate: number;
}

export interface RadarResponse {
  success: boolean;
  programs: ProgramEligibility[];
  alerts: Alert[];
  summary: EligibilitySummary;
  calculatedAt: string;
}

interface UseEligibilityRadarResult {
  programs: ProgramEligibility[];
  alerts: Alert[];
  summary: EligibilitySummary | null;
  isCalculating: boolean;
  error: string | null;
  lastUpdated: string | null;
  calculate: (data: HouseholdData) => void;
}

/**
 * Hook for real-time cross-program eligibility tracking
 * Debounces calculations and caches previous results for change detection
 */
export function useEligibilityRadar(debounceMs: number = 500): UseEligibilityRadarResult {
  const [programs, setPrograms] = useState<ProgramEligibility[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<EligibilitySummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  
  // Store previous results for change detection
  const previousResultsRef = useRef<{
    snap?: number;
    medicaid?: boolean;
    tanf?: number;
    eitc?: number;
    ctc?: number;
    ssi?: number;
  }>({});
  
  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Calculate eligibility (debounced)
  const calculate = useCallback((data: HouseholdData) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Set calculating state immediately for UI feedback
    setIsCalculating(true);
    setError(null);
    
    // Debounce the actual API call
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        // Build previous results from stored data
        const requestData = {
          ...data,
          previousResults: previousResultsRef.current
        };
        
        // Get CSRF token for state-changing request
        const csrfResponse = await fetch('/api/csrf-token', {
          credentials: 'include',
        });
        if (!csrfResponse.ok) {
          throw new Error('Failed to fetch CSRF token');
        }
        const csrfData = await csrfResponse.json();
        
        // Fetch with abort signal for request cancellation
        const response = await fetch('/api/eligibility/radar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfData.token,
          },
          body: JSON.stringify(requestData),
          credentials: 'include',
          signal: abortControllerRef.current.signal
        });
        
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`${response.status}: ${text}`);
        }
        
        const responseData = await response.json() as RadarResponse;
        
        if (responseData.success) {
          setPrograms(responseData.programs);
          setAlerts(responseData.alerts);
          setSummary(responseData.summary);
          setLastUpdated(responseData.calculatedAt);
          
          // Store current results for next comparison
          const snapProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'MD_SNAP');
          const medicaidProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'MD_MEDICAID');
          const tanfProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'MD_TANF');
          const eitcProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'EITC');
          const ctcProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'CTC');
          const ssiProgram = responseData.programs.find((p: ProgramEligibility) => p.id === 'SSI');
          
          previousResultsRef.current = {
            snap: snapProgram?.monthlyAmount,
            medicaid: medicaidProgram?.eligible,
            tanf: tanfProgram?.monthlyAmount,
            eitc: eitcProgram?.annualAmount,
            ctc: ctcProgram?.annualAmount,
            ssi: ssiProgram?.monthlyAmount
          };
        }
      } catch (err: any) {
        // Ignore abort errors
        if (err.name !== 'AbortError') {
          // console.error('Eligibility calculation error:', err);
          setError(err.message || 'Failed to calculate eligibility');
        }
      } finally {
        setIsCalculating(false);
      }
    }, debounceMs);
  }, [debounceMs]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    programs,
    alerts,
    summary,
    isCalculating,
    error,
    lastUpdated,
    calculate
  };
}

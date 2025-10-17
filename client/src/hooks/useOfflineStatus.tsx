/**
 * Offline Status Hook
 * 
 * Detects online/offline status and manages offline queue processing
 */

import { useEffect, useState } from 'react';
import { processQueue } from '@/lib/pwa/offlineStorage';

export interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  queuedRequestsCount: number;
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [queuedRequestsCount, setQueuedRequestsCount] = useState(0);
  
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      if (wasOffline) {
        // Process queued requests
        try {
          const result = await processQueue();
          setQueuedRequestsCount(0);
          
          if (result.success > 0) {
            console.log(`Successfully processed ${result.success} queued requests`);
          }
          
          if (result.failed > 0) {
            console.warn(`Failed to process ${result.failed} queued requests`);
          }
        } catch (error) {
          console.error('Error processing queue:', error);
        }
      }
      
      setWasOffline(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);
  
  return {
    isOnline,
    wasOffline,
    queuedRequestsCount,
  };
}

/**
 * Offline Banner Component
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useOfflineStatus();
  
  if (isOnline && !wasOffline) {
    return null;
  }
  
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center transition-colors ${
        isOnline
          ? 'bg-success text-success-foreground'
          : 'bg-warning text-warning-foreground'
      }`}
    >
      {isOnline ? (
        <>
          <span className="font-semibold">✓ Back online</span>
          <span className="ml-2">Your changes are being saved</span>
        </>
      ) : (
        <>
          <span className="font-semibold">⚠ You are offline</span>
          <span className="ml-2">Your work will be saved and synced when you reconnect</span>
        </>
      )}
    </div>
  );
}

/**
 * Auto-save draft hook for forms
 */
export function useAutoSaveDraft(
  formType: 'vita-intake' | 'benefit-screener' | 'tax-prep' | 'irs-consent' | 'appointment',
  formId: string,
  formData: any,
  enabled: boolean = true
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  useEffect(() => {
    if (!enabled || !formData) return;
    
    const saveTimeout = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        const { saveDraft } = await import('@/lib/pwa/offlineStorage');
        await saveDraft({
          id: formId,
          formType,
          data: formData,
        });
        
        setLastSaved(new Date());
      } catch (error) {
        console.error('Error saving draft:', error);
      } finally {
        setIsSaving(false);
      }
    }, 2000); // Debounce 2 seconds
    
    return () => clearTimeout(saveTimeout);
  }, [formData, formType, formId, enabled]);
  
  return {
    isSaving,
    lastSaved,
  };
}

/**
 * Load draft hook
 */
export function useLoadDraft(
  formType: 'vita-intake' | 'benefit-screener' | 'tax-prep' | 'irs-consent' | 'appointment',
  formId: string
) {
  const [draft, setDraft] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function loadDraft() {
      try {
        const { getDraft } = await import('@/lib/pwa/offlineStorage');
        const savedDraft = await getDraft(formId);
        
        if (savedDraft && savedDraft.formType === formType) {
          setDraft(savedDraft.data);
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDraft();
  }, [formType, formId]);
  
  return {
    draft,
    isLoading,
  };
}

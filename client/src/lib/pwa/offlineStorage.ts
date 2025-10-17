/**
 * IndexedDB Offline Storage
 * 
 * Stores form drafts and failed requests for offline capability
 */

const DB_NAME = 'maryland-benefits-offline';
const DB_VERSION = 1;
const DRAFTS_STORE = 'form-drafts';
const QUEUE_STORE = 'request-queue';

export interface FormDraft {
  id: string;
  formType: 'vita-intake' | 'benefit-screener' | 'tax-prep' | 'irs-consent' | 'appointment';
  data: any;
  timestamp: number;
  lastModified: number;
}

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  retryCount: number;
}

/**
 * Initialize IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create drafts store
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        const draftsStore = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
        draftsStore.createIndex('formType', 'formType', { unique: false });
        draftsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Create request queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save form draft
 */
export async function saveDraft(draft: Omit<FormDraft, 'timestamp' | 'lastModified'>): Promise<void> {
  const db = await openDB();
  
  const fullDraft: FormDraft = {
    ...draft,
    timestamp: draft.id.includes('-') ? parseInt(draft.id.split('-').pop() || '0') : Date.now(),
    lastModified: Date.now(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFTS_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.put(fullDraft);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get form draft by ID
 */
export async function getDraft(id: string): Promise<FormDraft | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFTS_STORE], 'readonly');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Get all drafts by form type
 */
export async function getDraftsByType(formType: FormDraft['formType']): Promise<FormDraft[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFTS_STORE], 'readonly');
    const store = transaction.objectStore(DRAFTS_STORE);
    const index = store.index('formType');
    const request = index.getAll(formType);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Delete form draft
 */
export async function deleteDraft(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFTS_STORE], 'readwrite');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Queue failed request for retry when online
 */
export async function queueRequest(request: Omit<QueuedRequest, 'timestamp' | 'retryCount'>): Promise<void> {
  const db = await openDB();
  
  const queuedRequest: QueuedRequest = {
    ...request,
    timestamp: Date.now(),
    retryCount: 0,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const req = store.put(queuedRequest);
    
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/**
 * Get all queued requests
 */
export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Remove request from queue
 */
export async function dequeueRequest(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Remove queued request (alias for dequeueRequest)
 * Used by service worker for background sync
 */
export async function removeQueuedRequest(id: string): Promise<void> {
  return dequeueRequest(id);
}

/**
 * Update retry count for queued request
 */
export async function updateRetryCount(id: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(QUEUE_STORE);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const request = getRequest.result;
      if (request) {
        request.retryCount += 1;
        const putRequest = store.put(request);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Process queued requests when back online
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  const requests = await getQueuedRequests();
  let success = 0;
  let failed = 0;
  
  for (const queuedRequest of requests) {
    try {
      const response = await fetch(queuedRequest.url, {
        method: queuedRequest.method,
        headers: queuedRequest.headers,
        body: queuedRequest.body ? JSON.stringify(queuedRequest.body) : undefined,
      });
      
      if (response.ok) {
        await dequeueRequest(queuedRequest.id);
        success++;
      } else {
        if (queuedRequest.retryCount >= 3) {
          // Remove after 3 failed retries
          await dequeueRequest(queuedRequest.id);
        } else {
          await updateRetryCount(queuedRequest.id);
        }
        failed++;
      }
    } catch (error) {
      if (queuedRequest.retryCount >= 3) {
        await dequeueRequest(queuedRequest.id);
      } else {
        await updateRetryCount(queuedRequest.id);
      }
      failed++;
    }
  }
  
  return { success, failed };
}

/**
 * Clear all offline data
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DRAFTS_STORE, QUEUE_STORE], 'readwrite');
    
    const draftsStore = transaction.objectStore(DRAFTS_STORE);
    const queueStore = transaction.objectStore(QUEUE_STORE);
    
    draftsStore.clear();
    queueStore.clear();
    
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

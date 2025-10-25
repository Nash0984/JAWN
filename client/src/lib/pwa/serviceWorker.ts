/**
 * Service Worker for Progressive Web App
 * 
 * Implements offline-first caching strategy:
 * - Cache-first for static assets
 * - Network-first for API calls with fallback
 * - Precaches critical pages
 */

const CACHE_NAME = 'maryland-benefits-v2';
const PUBLIC_API_CACHE = 'public-api-cache-v2';
const OFFLINE_PAGE = '/offline.html';

// Critical pages to precache
const CRITICAL_PAGES = [
  '/',
  '/offline.html',
  '/benefit-screener',
  '/vita-intake',
  '/tax-preparation',
];

// Static assets to cache
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/maryland-seal.svg',
];

// SECURITY: Whitelist of public API endpoints safe to cache
// ONLY these endpoints contain no PII and can be cached
const PUBLIC_API_PATTERNS = [
  /\/api\/public\/.*/,           // Explicit public routes
  /\/api\/benefit-programs$/,    // Program list (no PII)
  /\/api\/counties$/,             // County list (public data)
];

/**
 * Check if an API endpoint is safe to cache (contains no PII)
 */
function isSafeToCacheAPI(url: string): boolean {
  return PUBLIC_API_PATTERNS.some(pattern => pattern.test(url));
}

const sw = self as any;

/**
 * Install event - Precache critical resources
 */
sw.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...CRITICAL_PAGES, ...STATIC_ASSETS]);
    })
  );
  
  // Activate immediately
  sw.skipWaiting();
});

/**
 * Activate event - Clean up old caches
 */
sw.addEventListener('activate', (event: any) => {
  const currentCaches = [CACHE_NAME, PUBLIC_API_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  
  // Take control immediately
  sw.clients.claim();
});

/**
 * Fetch event - Implement caching strategies
 */
sw.addEventListener('fetch', (event: any) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // API requests - SECURITY: Only cache whitelisted public endpoints
  if (url.pathname.startsWith('/api/')) {
    if (isSafeToCacheAPI(url.pathname)) {
      // Public endpoints safe to cache
      event.respondWith(networkFirstPublicAPI(request));
    } else {
      // SECURITY: Sensitive endpoints - NEVER cache (may contain PII)
      event.respondWith(networkOnlyAPI(request));
    }
    return;
  }
  
  // Static assets - Cache strategy based on file type and environment
  // Development: Network-first for JS to prevent stale modules
  // Production: Cache-first for all static assets
  const isDevelopment = sw.location.hostname === 'localhost' || 
                        sw.location.hostname.includes('replit.dev');
  
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|woff|woff2)$/) ||
      STATIC_ASSETS.includes(url.pathname)) {
    // Images and fonts always cache-first
    event.respondWith(cacheFirst(request));
    return;
  }
  
  if (url.pathname.match(/\.(js|css)$/)) {
    // JS and CSS: Network-first in development, cache-first in production
    event.respondWith(isDevelopment ? networkFirst(request) : cacheFirst(request));
    return;
  }
  
  // HTML pages - Network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }
  
  // Default - Network-first
  event.respondWith(networkFirst(request));
});

/**
 * Cache-first strategy - For static assets
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy - For general requests (non-API)
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Network-first for PUBLIC API endpoints - Safe to cache (no PII)
 */
async function networkFirstPublicAPI(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Cache successful responses in separate public API cache
    if (response.ok) {
      const cache = await caches.open(PUBLIC_API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Network-only for SENSITIVE API endpoints - NEVER cache (may contain PII)
 * SECURITY: Prevents household data, benefits, tax info from being stored on device
 */
async function networkOnlyAPI(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // NO cache fallback for sensitive data
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'This data requires an internet connection and cannot be accessed offline for security reasons.' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Network-first with offline page fallback - For HTML pages
 */
async function networkFirstWithOffline(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache first
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Fallback to offline page
    const offlinePage = await caches.match(OFFLINE_PAGE);
    if (offlinePage) {
      return offlinePage;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Background sync event - Retry failed requests when back online
 */
sw.addEventListener('sync', async (event: any) => {
  if (event.tag === 'sync-queued-requests') {
    event.waitUntil(syncFailedRequests());
  }
});

/**
 * Sync failed requests from IndexedDB
 * SECURITY FIX: Implements actual background sync with request replay
 */
async function syncFailedRequests() {
  try {
    // Dynamic import to access offlineStorage from service worker context
    const { getQueuedRequests, dequeueRequest } = await import('./offlineStorage.js');
    const queued = await getQueuedRequests();
    
    // Keep: PWA sync status - important for offline functionality
    console.log(`🔄 Syncing ${queued.length} queued requests...`);
    
    for (const req of queued) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        
        if (response.ok) {
          await dequeueRequest(req.id);
          // Keep: PWA sync success - important for offline functionality
          console.log('✅ Synced queued request:', req.method, req.url);
        } else {
          // Keep: PWA sync failure - important for debugging offline issues
          console.error('❌ Failed to sync request (bad response):', req.method, req.url, response.status);
          // Keep in queue for retry
        }
      } catch (error) {
        // Keep: PWA sync error - important for debugging offline issues
        console.error('❌ Failed to sync request:', req.method, req.url, error);
        // Keep in queue for retry
      }
    }
  } catch (error) {
    // Keep: PWA sync error - important for debugging offline issues
    console.error('❌ Error in syncFailedRequests:', error);
  }
}

/**
 * Message event - Handle commands from clients
 */
sw.addEventListener('message', (event: any) => {
  if (event.data === 'skipWaiting') {
    sw.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
    );
  }
});

export {};

// Service Worker for Polymarket Trading Agent PWA
// Version 4.0 - Production Ready

const CACHE_NAME = 'polymarket-trading-agent-v4.0';
const STATIC_CACHE = 'polymarket-static-v4.0';
const DYNAMIC_CACHE = 'polymarket-dynamic-v4.0';
const API_CACHE = 'polymarket-api-v4.0';

// Cache durations
const CACHE_DURATIONS = {
    static: 24 * 60 * 60 * 1000,      // 24 hours
    dynamic: 1 * 60 * 60 * 1000,      // 1 hour  
    api: 5 * 60 * 1000                // 5 minutes
};

// Files to cache immediately
const CORE_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/app-working.js',
    '/js/config/production-config.js',
    '/js/core/polymarket-api.js',
    '/js/core/real-polymarket-api.js',
    '/js/core/wallet-manager.js',
    '/js/core/real-websocket-manager.js',
    '/js/trading/trading-engine.js',
    '/js/trading/market-analyzer.js',
    '/js/trading/smart-orders.js',
    '/js/ui/ui-manager.js',
    '/js/data/database.js',
    '/js/utils/logger.js',
    '/js/security/security-manager.js',
    '/js/security/privacy-manager.js',
    '/js/monitoring/alert-system.js',
    '/js/deployment/production-installer.js',
    '/manifest.json',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
];

// API patterns to cache
const API_PATTERNS = [
    /^https:\/\/gamma-api\.polymarket\.com\/markets/,
    /^https:\/\/clob\.polymarket\.com\/book/,
    /^https:\/\/clob\.polymarket\.com\/midpoint/
];

// Install event - cache core files
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache core application files
            caches.open(STATIC_CACHE).then(cache => {
                console.log('📦 Service Worker: Caching core files...');
                return cache.addAll(CORE_FILES.map(url => new Request(url, {
                    cache: 'reload' // Bypass cache during install
                })));
            }),
            
            // Initialize dynamic cache
            caches.open(DYNAMIC_CACHE),
            
            // Initialize API cache
            caches.open(API_CACHE)
        ]).then(() => {
            console.log('✅ Service Worker: Installation complete');
            
            // Force activation of new service worker
            return self.skipWaiting();
        }).catch(error => {
            console.error('❌ Service Worker: Installation failed:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            cleanupOldCaches(),
            
            // Take control of all pages immediately
            self.clients.claim(),
            
            // Initialize background sync
            setupBackgroundSync(),
            
            // Set up periodic background sync
            setupPeriodicBackgroundSync()
            
        ]).then(() => {
            console.log('✅ Service Worker: Activation complete');
        }).catch(error => {
            console.error('❌ Service Worker: Activation failed:', error);
        })
    );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests for caching
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle different types of requests
    if (isStaticAsset(request)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(request)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isNavigationRequest(request)) {
        event.respondWith(handleNavigationRequest(request));
    } else {
        event.respondWith(handleDynamicContent(request));
    }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-data-sync') {
        event.waitUntil(syncOfflineData());
    }
    
    if (event.tag === 'market-data-update') {
        event.waitUntil(updateMarketData());
    }
    
    if (event.tag === 'analytics-sync') {
        event.waitUntil(syncAnalytics());
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    console.log('⏰ Service Worker: Periodic sync triggered:', event.tag);
    
    if (event.tag === 'market-data-refresh') {
        event.waitUntil(refreshMarketData());
    }
});

// Push notifications (for future implementation)
self.addEventListener('push', (event) => {
    console.log('📱 Service Worker: Push notification received:', event.data);
    
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(showNotification(data));
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('📱 Service Worker: Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    // Handle notification actions
    event.waitUntil(
        clients.matchAll().then(clientList => {
            // Try to focus existing window
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Open new window if none exists
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
    console.log('💬 Service Worker: Message received:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
                
            case 'CACHE_UPDATE':
                updateCache(event.data.urls);
                break;
                
            case 'CLEAR_CACHE':
                clearSpecificCache(event.data.cacheName);
                break;
                
            case 'GET_CACHE_STATUS':
                getCacheStatus().then(status => {
                    event.ports[0].postMessage(status);
                });
                break;
                
            case 'SYNC_DATA':
                registerBackgroundSync(event.data.tag);
                break;
        }
    }
});

// Helper Functions

function isStaticAsset(request) {
    const url = new URL(request.url);
    return CORE_FILES.some(file => url.pathname === file) ||
           url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/);
}

function isAPIRequest(request) {
    const url = new URL(request.url);
    return API_PATTERNS.some(pattern => pattern.test(request.url)) ||
           url.hostname.includes('polymarket.com');
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' || 
           (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

async function handleStaticAsset(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.static)) {
            return cachedResponse;
        }
        
        // Fetch from network and update cache
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Static asset fetch failed:', error);
        
        // Return cached version even if expired
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback
        return createOfflineFallback(request);
    }
}

async function handleAPIRequest(request) {
    try {
        // Try network first for API requests (fresh data preferred)
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error(`API request failed: ${networkResponse.status}`);
        
    } catch (error) {
        console.warn('API request failed, trying cache:', error);
        
        // Fall back to cached response
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.api * 2)) {
            // Add stale indicator header
            const response = cachedResponse.clone();
            response.headers.set('X-Served-From', 'cache-stale');
            return response;
        }
        
        // Return error response for failed API calls
        return new Response(JSON.stringify({
            error: 'Network unavailable',
            cached: false,
            timestamp: Date.now()
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json',
                'X-Served-From': 'service-worker'
            }
        });
    }
}

async function handleNavigationRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Update dynamic cache
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error(`Navigation failed: ${networkResponse.status}`);
        
    } catch (error) {
        console.warn('Navigation request failed, serving cached app shell:', error);
        
        // Serve app shell from cache
        const appShell = await caches.match('/index.html');
        if (appShell) {
            return appShell;
        }
        
        // Create offline page
        return createOfflinePage();
    }
}

async function handleDynamicContent(request) {
    try {
        // Check cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATIONS.dynamic)) {
            return cachedResponse;
        }
        
        // Fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        // Return cached version if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return generic offline response
        return createOfflineFallback(request);
    }
}

function isExpired(response, maxAge) {
    const dateHeader = response.headers.get('date');
    if (!dateHeader) return false;
    
    const responseTime = new Date(dateHeader).getTime();
    const now = Date.now();
    
    return (now - responseTime) > maxAge;
}

async function cleanupOldCaches() {
    const cacheNames = await caches.keys();
    const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
    
    const deletionPromises = cacheNames
        .filter(cacheName => !validCaches.includes(cacheName))
        .map(cacheName => {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
        });
    
    return Promise.all(deletionPromises);
}

function setupBackgroundSync() {
    // Register background sync capabilities
    return Promise.resolve();
}

function setupPeriodicBackgroundSync() {
    // Set up periodic background sync if supported
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        return self.registration.periodicSync.register('market-data-refresh', {
            minInterval: 5 * 60 * 1000 // 5 minutes minimum
        });
    }
    
    return Promise.resolve();
}

async function syncOfflineData() {
    console.log('🔄 Syncing offline data...');
    
    try {
        // Get offline actions from IndexedDB
        const offlineActions = await getOfflineActions();
        
        for (const action of offlineActions) {
            try {
                await processOfflineAction(action);
                await removeOfflineAction(action.id);
            } catch (error) {
                console.error('Failed to process offline action:', error);
            }
        }
        
        console.log('✅ Offline data sync complete');
        
    } catch (error) {
        console.error('❌ Offline data sync failed:', error);
    }
}

async function updateMarketData() {
    console.log('📊 Updating market data...');
    
    try {
        // Fetch fresh market data
        const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=50');
        
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put('https://gamma-api.polymarket.com/markets?closed=false&limit=50', response.clone());
            
            // Notify main thread
            broadcastUpdate('market-data-updated', await response.json());
        }
        
    } catch (error) {
        console.error('Market data update failed:', error);
    }
}

async function syncAnalytics() {
    console.log('📈 Syncing analytics data...');
    
    try {
        // Send queued analytics events
        const analyticsQueue = await getAnalyticsQueue();
        
        if (analyticsQueue.length > 0) {
            const response = await fetch('/api/analytics', {
                method: 'POST',
                body: JSON.stringify(analyticsQueue),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                await clearAnalyticsQueue();
            }
        }
        
    } catch (error) {
        console.error('Analytics sync failed:', error);
    }
}

async function refreshMarketData() {
    console.log('⏰ Periodic market data refresh...');
    
    try {
        // Update cached market data
        await updateMarketData();
        
        // Clean up old API cache entries
        await cleanupApiCache();
        
    } catch (error) {
        console.error('Periodic refresh failed:', error);
    }
}

async function showNotification(data) {
    const options = {
        body: data.message,
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        tag: data.tag || 'default',
        requireInteraction: data.priority === 'high',
        actions: data.actions || [],
        data: data.data || {}
    };
    
    return self.registration.showNotification(data.title, options);
}

function createOfflineFallback(request) {
    const url = new URL(request.url);
    
    if (url.pathname.endsWith('.js')) {
        return new Response('console.log("Offline - script not available");', {
            headers: { 'Content-Type': 'application/javascript' }
        });
    }
    
    if (url.pathname.endsWith('.css')) {
        return new Response('/* Offline - styles not available */', {
            headers: { 'Content-Type': 'text/css' }
        });
    }
    
    if (url.pathname.endsWith('.json')) {
        return new Response(JSON.stringify({ offline: true, error: 'Data not available' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Default fallback
    return new Response('Resource not available offline', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

function createOfflinePage() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - Polymarket Trading Agent</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                    padding: 50px 20px;
                    min-height: 100vh;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .offline-container {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 40px;
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                    max-width: 500px;
                }
                h1 { font-size: 48px; margin: 0 0 20px 0; }
                p { font-size: 18px; margin: 0 0 30px 0; opacity: 0.9; }
                .retry-btn {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    font-size: 16px;
                    cursor: pointer;
                    transition: background 0.3s;
                }
                .retry-btn:hover { background: #218838; }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <h1>🌐</h1>
                <h2>You're Offline</h2>
                <p>The Polymarket Trading Agent requires an internet connection for trading operations.</p>
                <p>Please check your connection and try again.</p>
                <button class="retry-btn" onclick="location.reload()">
                    🔄 Retry Connection
                </button>
            </div>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        headers: { 'Content-Type': 'text/html' }
    });
}

async function updateCache(urls) {
    const cache = await caches.open(STATIC_CACHE);
    
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
            }
        } catch (error) {
            console.error(`Failed to update cache for ${url}:`, error);
        }
    }
}

async function clearSpecificCache(cacheName) {
    return await caches.delete(cacheName);
}

async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = keys.length;
    }
    
    return status;
}

function registerBackgroundSync(tag) {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        return self.registration.sync.register(tag);
    }
    
    return Promise.resolve();
}

function broadcastUpdate(type, data) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: type,
                data: data
            });
        });
    });
}

async function cleanupApiCache() {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    
    const now = Date.now();
    const maxAge = CACHE_DURATIONS.api * 3; // Keep for 3x the normal duration
    
    for (const request of requests) {
        const response = await cache.match(request);
        if (response && isExpired(response, maxAge)) {
            await cache.delete(request);
        }
    }
}

// Placeholder functions for offline functionality
async function getOfflineActions() {
    // Would integrate with IndexedDB to get queued offline actions
    return [];
}

async function processOfflineAction(action) {
    // Would process the offline action (e.g., placing a trade that was queued)
    return Promise.resolve();
}

async function removeOfflineAction(id) {
    // Would remove the processed action from IndexedDB
    return Promise.resolve();
}

async function getAnalyticsQueue() {
    // Would get queued analytics events from IndexedDB
    return [];
}

async function clearAnalyticsQueue() {
    // Would clear the analytics queue after successful sync
    return Promise.resolve();
}

// Debug logging
console.log('🚀 Service Worker v4.0 loaded successfully');
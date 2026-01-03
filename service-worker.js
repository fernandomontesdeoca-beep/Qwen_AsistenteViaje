const CACHE_NAME = 'trip-assistant-v1.0.44';
const OFFLINE_CACHE_NAME = 'trip-assistant-offline-v1';
const RUNTIME_CACHE_NAME = 'trip-assistant-runtime-v1';
const IS_PRODUCTION = true;

const CORE_ASSETS = [
'./',
'./index.html',
'./manifest.json',
'./version.json'
];

const EXTERNAL_ASSETS = [
'https://cdn.tailwindcss.com',
'https://unpkg.com/react@18/umd/react.production.min.js',
'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
'https://unpkg.com/@babel/standalone/babel.min.js'
];

const OFFLINE_PAGES = [
'./offline.html'
];

self.addEventListener('install', (event) => {
console.log('[Service Worker] Installing...');
  
event.waitUntil(
Promise.all([
caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)),
caches.open(OFFLINE_CACHE_NAME).then(cache => cache.addAll(OFFLINE_PAGES)),
caches.open(RUNTIME_CACHE_NAME).then(cache => cache.addAll(EXTERNAL_ASSETS))
]).then(() => {
console.log('[Service Worker] All caches opened and populated');
})
);
  
self.skipWaiting();
});

self.addEventListener('activate', (event) => {
console.log('[Service Worker] Activating...');
  
event.waitUntil(
caches.keys().then(cacheNames => {
return Promise.all(
cacheNames.map(cacheName => {
if (![CACHE_NAME, OFFLINE_CACHE_NAME, RUNTIME_CACHE_NAME].includes(cacheName)) {
console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
return caches.delete(cacheName);
}
})
);
}).then(() => {
console.log('[Service Worker] Claiming clients');
return self.clients.claim();
})
);
});

self.addEventListener('fetch', (event) => {
const request = event.request;
const url = new URL(request.url);
  
// Ignorar solicitudes de origen diferente (excepto GitHub para updates)
if (url.origin !== self.location.origin && !url.href.includes('github.com')) {
return;
}
  
// Estrategia para version.json (siempre desde red)
if (url.pathname.endsWith('version.json')) {
event.respondWith(
fetch(request).catch(() => {
return caches.match('./version.json');
})
);
return;
}
  
// Estrategia para assets core (cache-first)
if (CORE_ASSETS.some(asset => url.pathname.endsWith(asset))) {
event.respondWith(
caches.match(request).then(response => {
return response || fetch(request).catch(() => {
return caches.match('./offline.html');
});
})
);
return;
}
  
// Estrategia para assets externos (stale-while-revalidate)
if (EXTERNAL_ASSETS.some(asset => url.href.includes(asset))) {
event.respondWith(
caches.open(RUNTIME_CACHE_NAME).then(cache => {
return fetch(request).then(networkResponse => {
cache.put(request, networkResponse.clone());
return networkResponse;
}).catch(() => {
return cache.match(request);
});
})
);
return;
}
  
// Estrategia por defecto (network-first con caché fallback)
event.respondWith(
fetch(request).catch(() => {
return caches.match(request).then(response => {
return response || caches.match('./offline.html');
});
})
);
});

// Actualizar caché cuando hay nueva versión
self.addEventListener('message', (event) => {
if (event.data && event.data.type === 'SKIP_WAITING') {
self.skipWaiting();
}
});

// Notificar al cliente cuando hay nueva versión
self.addEventListener('install', (event) => {
event.waitUntil(
self.skipWaiting().then(() => {
return self.clients.matchAll({ type: 'window' }).then(clients => {
clients.forEach(client => {
client.postMessage({
type: 'NEW_VERSION_AVAILABLE',
version: CACHE_NAME.replace('trip-assistant-', '')
});
});
});
})
);
});

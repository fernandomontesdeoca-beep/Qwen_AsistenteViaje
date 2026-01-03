// Estrategia: Network first con caché como fallback
self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests
  if (event.request.method !== 'GET') return;
  
  // Excluir URLs de APIs externas
  if (event.request.url.includes('github.com')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Actualizar caché en background
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          })
        );
        return networkResponse;
      })
      .catch(() => {
        // Fallback a caché si falla la red
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./offline.html');
        });
      })
  );
});

// Manejar actualizaciones de versión
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notificar al cliente cuando hay nueva versión disponible
self.addEventListener('install', (event) => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // Notificar al cliente que hay nueva versión
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NEW_VERSION_AVAILABLE',
            version: CACHE_NAME.replace('trip-assistant-', '')
          });
        });
      });
    })
  );
});

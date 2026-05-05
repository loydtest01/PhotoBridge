// ═══ PhotoBridge Service Worker ═══
// Bump CACHE_VERSION při každém deployi (nebo ho generuj automaticky z daty)
const CACHE_VERSION = 'pb-v1.0.1';
const CACHE_NAME    = CACHE_VERSION;

// Soubory které chceme cachovat při instalaci
const PRECACHE_URLS = [
  './',
  './index.html',
  './mobile-manifest.json',
  './icon_192.png',
  './icon_512.png',
];

// ── Install: nacachuj app shell ──
self.addEventListener('install', event => {
  // skipWaiting = aktivuj nový SW okamžitě (nečekej na zavření všech tabů)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        // Pokud některý soubor není dostupný (např. při offline), ignoruj chybu
        console.warn('[SW] Precache partial fail:', err);
      });
    })
  );
});

// ── Activate: smaž staré cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Mazám starou cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // Převezmi kontrolu nad všemi otevřenými taby ihned
      return self.clients.claim();
    })
  );
});

// ── Fetch: Network-first pro HTML, Cache-first pro assety ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Přeskočit non-GET requesty a cross-origin (Supabase API, CDN fonts…)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // HTML stránky — vždy zkus síť jako první (aby aktualizace proběhly)
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Ulož novou verzi do cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)) // offline fallback
    );
    return;
  }

  // Ostatní assety (ikony, obrázky…) — Cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ── Message handler ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ═══ PhotoBridge Service Worker ═══
// Bump CACHE_VERSION při každém deployi (nebo ho generuj automaticky z daty)
const CACHE_VERSION = 'pb-v1.0.5';
const CACHE_NAME    = CACHE_VERSION;
const SHARE_CACHE   = 'pb-share-v1';   // dočasné úložiště fotek sdílených z galerie

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
          .filter(key => key !== CACHE_NAME && key !== SHARE_CACHE)
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

  // ── Sdílení z galerie (Web Share Target): zachyť POST na share-target.html ──
  if (request.method === 'POST' && url.pathname.endsWith('/share-target.html')) {
    event.respondWith((async () => {
      try {
        const formData = await request.formData();
        const files = formData.getAll('photos').filter(f => f && f.size > 0);
        const cache = await caches.open(SHARE_CACHE);
        const meta = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const key = `shared-${Date.now()}-${i}`;
          await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
          meta.push({ key, name: f.name || `foto-${i}.jpg`, type: f.type || 'image/jpeg' });
        }
        await cache.put('shared-meta', new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
        return Response.redirect('./index.html?shared=1', 303);
      } catch (e) {
        return Response.redirect('./index.html?shared=err', 303);
      }
    })());
    return;
  }

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

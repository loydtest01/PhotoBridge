// ═══ PhotoBridge Service Worker ═══
// Bump CACHE_VERSION při každém deployi (nebo ho generuj automaticky z data).
const CACHE_VERSION = 'pb-v1.0.23';   // mobil v1.4.7 – klíče až po přihlášení
const CACHE_NAME    = CACHE_VERSION;
const SHARE_CACHE   = 'pb-share-v1';   // dočasné úložiště fotek sdílených z galerie

// Lokální soubory app shellu – cachuj při instalaci.
const PRECACHE_URLS = [
  './',
  './index.html',
  './share-target.html',
  './mobile-manifest.json',
  './favicon.ico',
  './icon_180.png',
  './icon_192.png',
  './icon_512.png',
];

// Externí CDN skripty (jsQR, zxing) – aby fungoval scanner i offline.
// jsdelivr posílá CORS hlavičky, takže je lze normálně nacachovat.
const PRECACHE_EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js',
];

// ── Install: nacachuj app shell ──
self.addEventListener('install', event => {
  // skipWaiting = aktivuj nový SW okamžitě (nečekej na zavření všech tabů)
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // POZOR: cache.addAll je atomické – když selže JEDEN soubor, necachne se NIC
    // a appka pak offline vůbec nejede. Proto cachujeme každý zvlášť (allSettled).
    const local = await Promise.allSettled(PRECACHE_URLS.map(u => cache.add(u)));
    local.forEach((r, i) => {
      if (r.status === 'rejected') console.warn('[SW] Precache fail:', PRECACHE_URLS[i], r.reason);
    });
    // Externí skripty jsou best-effort – jejich výpadek nesmí shodit instalaci.
    await Promise.allSettled(PRECACHE_EXTERNAL.map(u => cache.add(u)));
  })());
});

// ── Activate: smaž staré cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== SHARE_CACHE)
          .map(key => {
            console.log('[SW] Mažu starou cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // převezmi kontrolu nad otevřenými taby ihned
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Sdílení z galerie (Web Share Target): zachyť POST na share-target.html ──
  // Běží čistě lokálně, takže funguje i offline.
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
        // Absolutní URL – Response.redirect na relativní URL někde hází chybu.
        return Response.redirect(new URL('index.html?shared=1', url).href, 303);
      } catch (e) {
        console.warn('[SW] Share-target fail:', e);
        return Response.redirect(new URL('index.html?shared=err', url).href, 303);
      }
    })());
    return;
  }

  // Dál řešíme jen GET.
  if (request.method !== 'GET') return;

  // ── Cross-origin (CDN skripty): cache-first, jinak síť ──
  // Bez tohohle by se offline nenačetly jsQR/zxing a scanner by spadl.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).catch(() => cached || Response.error()))
    );
    return;
  }

  // ── Navigace / HTML — network-first, offline fallback na app shell ──
  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Ulož čerstvou verzi app shellu pod ČISTÝ klíč (ne s ?shared=1),
          // ať offline fallback vždy najde použitelný index.html.
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', clone)).catch(() => {});
          return response;
        })
        .catch(async () => {
          // KLÍČOVÁ OPRAVA: navigace ze share-target přijde jako index.html?shared=1,
          // ale v cache je čistý index.html → bez ignoreSearch by match nic nenašel
          // a appka by se offline vůbec neotevřela.
          return (
            (await caches.match(request, { ignoreSearch: true })) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            Response.error()
          );
        })
    );
    return;
  }

  // ── Ostatní lokální assety (ikony, obrázky…) — cache-first ──
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
        }
        return response;
      });
    })
  );
});

// ── Message handler ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

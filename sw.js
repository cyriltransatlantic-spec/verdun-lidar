// Service worker: keeps the app usable with no signal.
// App files: served from cache instantly, refreshed in the background.
// IGN map tiles: served from the offline tile cache when downloaded, otherwise from the network.

const SHELL = 'shell-v1';
const TILES = 'tiles-v1';
const SHELL_FILES = [
  './', 'index.html', 'style.css', 'app.js', 'overlays.js', 'manifest.webmanifest',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'data.geopf.fr' && url.searchParams.get('REQUEST') === 'GetTile') {
    e.respondWith((async () => {
      const hit = await caches.match(req.url, { cacheName: TILES, ignoreVary: true });
      if (hit) return hit;
      try { return await fetch(req); }
      catch { return new Response('', { status: 504, statusText: 'offline' }); }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return (await net) || new Response('Offline', { status: 503 });
    })());
  }
});

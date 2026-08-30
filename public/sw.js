/**
 * Ouistiti's service worker.
 *
 * The job it exists for: a parent standing in a Lausanne stairwell with one bar
 * of signal should still get the map and the last set of activities they saw,
 * rather than a dinosaur. Three strategies, chosen per request type:
 *
 *   - App shell: cache-first. It changes only when we deploy.
 *   - Map tiles: stale-while-revalidate. A slightly old tile of Lausanne is
 *     indistinguishable from a fresh one, and refetching them is the single
 *     biggest thing we could do to someone's data plan.
 *   - API: network-first with a cache fallback. "Still happening?" has to be
 *     answered by the network when there is one — stale status is worse than
 *     none — but a cached list beats an empty screen when there isn't.
 */

const VERSION = "v1";
const SHELL_CACHE = `ouistiti-shell-${VERSION}`;
const TILE_CACHE = `ouistiti-tiles-${VERSION}`;
const API_CACHE = `ouistiti-api-${VERSION}`;

const SHELL_URLS = ["/", "/ajouter", "/manifest.webmanifest"];

/** Tiles are small and numerous; keep a lid on how many we hoard. */
const MAX_TILES = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 doesn't fail the whole install.
      .then((cache) =>
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, TILE_CACHE, API_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Oldest first, which is insertion order for the Cache API.
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
  );
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(cacheName, MAX_TILES);
      }
      return response;
    })
    .catch(() => null);

  return cached ?? (await network) ?? Response.error();
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and nothing cached");
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE));
    return;
  }

  // Only same-origin from here; leave everything else to the browser.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    // A status report must never be answered from cache.
    if (url.pathname.includes("/reports")) return;
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(() =>
        caches.match("/").then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

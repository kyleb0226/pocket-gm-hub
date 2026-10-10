/* Offline cache for Pocket GM — Hockey.
 *
 * Paths are RELATIVE to the service worker's own location, so the same file
 * works whether the game is served from a domain root, a project subpath like
 * /hockey-gm/, or a LAN address off a laptop. soccer-gm hardcodes /soccer-gm/
 * and breaks anywhere else; don't copy that.
 *
 * Network-first for the page so a new build is picked up, cache-first for the
 * vendored libraries because they never change and they're 2.9 MB — which is
 * the difference between a usable phone app and a slow one.
 */
const CACHE = "hockey-gm-v1";
const base = new URL("./", self.registration.scope).pathname;
const ASSETS = [
  base,
  base + "index.html",
  base + "manifest.json",
  base + "icon-192.png",
  base + "icon-512.png",
  base + "apple-touch-icon.png",
  base + "vendor/react.production.min.js",
  base + "vendor/react-dom.production.min.js",
  base + "vendor/babel.min.js",
  base + "vendor/tailwind.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // One bad URL must not sink the whole install.
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The vendored libraries are immutable — never wait on the network for them.
  if (url.pathname.includes("/vendor/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Everything else: try the network, fall back to whatever we have offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(base + "index.html")))
  );
});

/* Service worker for the Pocket GM menu page only.
 *
 * Its scope is the domain root, so it also sees requests for /soccer/, /baseball/
 * and /hockey/. It deliberately does NOT answer those: each game ships its own
 * worker at /<game>/sw.js, which takes over that scope once the game has been
 * opened. Passing through (no respondWith) leaves the browser's default fetch in
 * charge, so the hub can never serve a stale copy of a game.
 */
const CACHE = "pocketgm-hub-v2";
// The three games and the menu share ONE origin on the hub, so they share CacheStorage.
// Activation clears only OUR old versions ("pocketgm-hub-*"); deleting every other cache wiped
// the sibling games' offline copies each time any one of them updated.
const GAMES = ["/soccer/", "/baseball/", "/hockey/"];
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k.indexOf("pocketgm-hub-") === 0).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (GAMES.some(p => url.pathname.startsWith(p))) return; // the games handle themselves

  // Network-first so a redeployed menu shows up immediately; cache is the offline net.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match("/index.html")))
  );
});

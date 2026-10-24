// The web version without internet: the first visit keeps a copy of the whole
// program (this build's files) on the phone, so it opens with no connection.
// With internet the page itself always comes from the site, so updates show
// on the next open; a new build replaces this copy.
// The three values below are filled in at build time (vite.tablet.config.ts).
// one copy per address: the same build can be served from more than one
// folder of the site (old link, new link, /preview/)
const PREFIX = __PREFIX__ + new URL(self.registration.scope).pathname + "-";
const CACHE = PREFIX + __VERSION__;
const FILES = __FILES__;
const page = () => new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(new URL(f, self.registration.scope), { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      // only this copy's older versions
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(page(), { cacheName: CACHE })));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
});

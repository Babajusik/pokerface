// Service worker PWA PokerFace: устанавливаемость + кэш статики (app shell).
// Игра требует сети (видео/сокеты), поэтому оффлайн не поддерживаем — только
// ускоряем повторную загрузку и не трогаем API/сокеты/чужие домены.
const CACHE = "pokerface-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/pwa-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // VPS/сторонние домены — мимо
  if (/^\/(rooms|online|livekit-token|api)\b/.test(url.pathname)) return; // API/сокеты не кэшируем

  // Навигация → network-first (свежий index.html), при офлайне — кэш.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  // Статика → cache-first, промах → сеть (с докэшированием).
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

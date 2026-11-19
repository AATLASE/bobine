/* Gather PWA service worker.
 * Gives the app installability ("Add to Home Screen") and an offline app shell.
 * We deliberately never cache cross-origin requests (Supabase auth/data/storage)
 * so the network stays the single source of truth for user data. */

const CACHE = "gather-shell-v2";
const SHELL = "/";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/* ------------------------------- Push -------------------------------- */

/* A push arrives as the JSON the Edge Function sent. Chrome requires that every
 * push shows something (we subscribed with userVisibleOnly), so an unreadable
 * payload still gets a generic notification rather than none at all. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Gather", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Gather";
  const url = payload.url || "/";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    /* The small icon in the Android status bar: Android keeps only its alpha
     * channel, so it has to be a white shape on transparent (an opaque square
     * shows as a blank white tile). */
    badge: "/badge-96.png",
    /* One notification per episode rather than a stack of near-identical
     * banners: a new comment replaces the previous one on the same episode. */
    tag: payload.tag || url || "gather",
    renotify: Boolean(payload.tag || payload.url),
    vibrate: [180, 80, 180],
    timestamp: Date.now(),
    actions: actionsFor(url),
    data: { url },
  };
  /* The episode's photo, shown large when the notification is expanded. */
  if (payload.image) options.image = payload.image;

  event.waitUntil(self.registration.showNotification(title, options));
});

/* One button under the text: it makes the notification taller and says what a
 * tap will do. */
function actionsFor(url) {
  if (url.startsWith("/review/")) return [{ action: "open", title: "Écrire ma review" }];
  if (url.startsWith("/episode/")) return [{ action: "open", title: "Voir l'épisode" }];
  if (url.startsWith("/create-episode/")) return [{ action: "open", title: "Ajouter un épisode" }];
  return [];
}

/* Tapping the notification should land on the episode it is about — and reuse
 * the tab the app is already open in rather than piling up windows. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open pages of the app itself: a notification carrying an outside
  // URL falls back to the home screen.
  let target = "/";
  try {
    const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    if (url.origin === self.location.origin) target = url.pathname + url.search + url.hash;
  } catch (e) {}

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* The browser can retire a subscription on its own (Chrome does it when a site
 * is unused for long enough). Resubscribing here keeps the endpoint alive; the
 * app stores the new one the next time it opens. */
self.addEventListener("pushsubscriptionchange", (event) => {
  const applicationServerKey = event.oldSubscription && event.oldSubscription.options
    ? event.oldSubscription.options.applicationServerKey
    : null;
  if (!applicationServerKey) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }).catch(() => {}),
  );
});

/* ------------------------------- Fetch -------------------------------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin requests. Supabase and other APIs must always hit
  // the network directly.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Static build assets: cache-first for instant repeat loads.
  const isStatic =
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico|json)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          }),
      ),
    );
  }
});

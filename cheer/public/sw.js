// Judgey's offline app shell (docs/backend-spec.md §8). Hand-written and tiny on
// purpose; registered from components/service-worker.tsx in production only,
// with updateViaCache: "none". Keep this file name stable.
//
// - Navigations to the app's pages: network first (4 s), else the cached copy of
//   that page, matched by pathname only (?meet=, ?mat=, ?team= are read on the
//   client). The running order itself comes from the localStorage cache.
// - /_next/static/*: cache first (content-hashed, immutable).
// - Everything else, including every Supabase call (another origin, and any
//   /rest/, /auth/, /realtime/ path): not touched, straight to the network.
//
// Bump VERSION only when this file's caching logic changes.

const VERSION = "v1";
const PAGES = `judgey-pages-${VERSION}`;
const STATIC = `judgey-static-${VERSION}`;
/** Every in-app page. Prerendered and static, so one copy serves any query string. */
const SHELL = ["/", "/meet", "/meet/mats", "/meet/favorites", "/meet/vote"];
const NAV_TIMEOUT_MS = 4000;
const MAX_STATIC = 300;
/** Re-download the whole shell (all pages + their chunks) at most this often, so pages stay in step after a deploy. */
const SHELL_REFRESH_MS = 10 * 60 * 1000;
const NEVER = /^\/(rest|auth|realtime|storage|functions|graphql)\/v1\b/;

let lastShellRefresh = 0;

const pathKey = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

/** Fetch every shell page and the static files its HTML references. Never throws. */
async function refreshShell() {
  lastShellRefresh = Date.now();
  const pages = await caches.open(PAGES);
  const assets = new Set();
  await Promise.allSettled(
    SHELL.map(async (path) => {
      const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok || res.redirected) return;
      const html = await res.clone().text();
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) assets.add(m[0]);
      await pages.put(path, res);
    }),
  );
  const statics = await caches.open(STATIC);
  await Promise.allSettled(
    [...assets].map(async (url) => {
      if (await statics.match(url)) return;
      const res = await fetch(url);
      if (res.ok) await statics.put(url, res);
    }),
  );
  await trimStatic();
}

async function trimStatic() {
  const statics = await caches.open(STATIC);
  const keys = await statics.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC)).map((k) => statics.delete(k)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(refreshShell().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const name of await caches.keys()) {
        if (name.startsWith("judgey-") && !keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

function offlinePage() {
  const html =
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>No signal</title><body style=\"margin:0;min-height:100vh;display:grid;place-content:center;" +
    'background:#0b0b14;color:#f5f3ff;font:16px system-ui;text-align:center;padding:16px">' +
    "<h1>No signal</h1><p>Open this page once with signal and it will work offline after that.</p></body>";
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function navigate(event) {
  const url = new URL(event.request.url);
  const path = pathKey(url.pathname);
  const key = SHELL.includes(path) ? path : null;
  // An unknown page under /meet (e.g. an old /meet/vote/<team> link) falls back to the My Team shell.
  const fallbackKey = key ?? (path.startsWith("/meet") ? "/meet" : "/");

  let put = Promise.resolve();
  const network = fetch(event.request).then((res) => {
    if (key && res.ok && !res.redirected && res.type === "basic") {
      const copy = res.clone();
      put = caches.open(PAGES).then((c) => c.put(key, copy));
    }
    if (res.ok && Date.now() - lastShellRefresh > SHELL_REFRESH_MS) {
      put = put.then(() => refreshShell());
    }
    return res;
  });
  event.waitUntil(network.then(() => put).catch(() => {}));

  const cached = await (await caches.open(PAGES)).match(fallbackKey);
  if (!cached) return network.catch(() => offlinePage());
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
  return Promise.race([network, timeout]).catch(() => cached);
}

async function cacheFirst(event) {
  const statics = await caches.open(STATIC);
  const hit = await statics.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    event.waitUntil(statics.put(event.request, copy).then(trimStatic).catch(() => {}));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname)) return;
  if (req.mode === "navigate") event.respondWith(navigate(event));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(cacheFirst(event));
});

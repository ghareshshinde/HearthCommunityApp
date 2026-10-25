// Keeps a visited ticket page available offline (C3). Only ticket pages are cached; everything else goes to the network.
const CACHE = 'hearth-tickets-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || !/^\/c\/[^/]+\/t\/[^/]+$/.test(url.pathname)) return
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res })
      .catch(() => caches.match(e.request).then((hit) => hit || new Response('You are offline and this ticket was not saved yet. Open it once with a connection.', { status: 503 }))),
  )
})

// Network-first cache so the app opens without signal (e.g. on the apron) after the first visit.
const CACHE = 'turnos-handling-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // The Android APK is large and always downloaded fresh.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('.apk')) return
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  )
})

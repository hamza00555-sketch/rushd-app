const CACHE_NAME = 'rushd-shell-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

const warmAppShell = async () => {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch('/', { cache: 'no-store' })
  if (!response.ok) throw new Error('Unable to cache the app shell.')
  await cache.put('/', response.clone())
  const html = await response.text()
  const builtAssets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g), (match) => match[1])
  await cache.addAll([...APP_SHELL.slice(1), ...new Set(builtAssets)])
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})

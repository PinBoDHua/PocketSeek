/* PocketSeek 离线壳：导航请求网络优先、静态资源缓存优先；API 请求不经过缓存。 */
const VERSION = 'pocketseek-v7'
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  /\.(?:js|css|woff2?|png|svg|webp|gif|ico|webmanifest)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(VERSION).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html').then((cached) => cached ?? Response.error()))
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put(request, copy))
            return response
          })
      )
    )
  }
})

/* PocketSeek 离线壳：导航请求网络优先、静态资源缓存优先；API 请求不经过缓存。 */
const VERSION = 'pocketseek-v8'
const SHARE_CACHE = 'pocketseek-share'
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
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSION && key !== SHARE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

const isStaticAsset = (url) =>
  url.origin === self.location.origin &&
  /\.(?:js|css|woff2?|png|svg|webp|gif|ico|webmanifest)$/.test(url.pathname)

/** PWA 分享目标使用 POST：先把表单暂存到 Cache，再 303 回页面读取。 */
const handleShareTarget = async (request) => {
  try {
    const form = await request.formData()
    const data = {
      title: String(form.get('title') ?? ''),
      text: String(form.get('text') ?? ''),
      url: String(form.get('url') ?? ''),
    }
    const cache = await caches.open(SHARE_CACHE)
    await cache.put(
      'latest',
      new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
    )
  } catch {
    // 表单解析失败时仍回到页面，由页面提示无分享内容。
  }
  return Response.redirect(new URL('./?share-target=1', self.location.href).href, 303)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }
  if (request.method === 'POST' && url.searchParams.has('share-target')) {
    event.respondWith(handleShareTarget(request))
    return
  }
  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const type = response.headers.get('Content-Type') ?? ''
          if (response.ok && type.includes('text/html')) {
            const copy = response.clone()
            caches.open(VERSION).then((cache) => cache.put('./index.html', copy))
          }
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
            if (response.ok && response.type === 'basic') {
              const copy = response.clone()
              caches.open(VERSION).then((cache) => cache.put(request, copy))
            }
            return response
          })
      )
    )
  }
})

/**
 * Service Worker：只缓存静态资源，绝不缓存 API。
 *
 * 缓存 API 响应会造成"改了状态却看到旧数据"，对一个以准确性为卖点的作息工具来说
 * 是致命的。接口层的缓存交给 TanStack Query 在内存里管，刷新即失效。
 *
 * 这里的目标很单纯：让 app shell 秒开，弱网下也能先把界面渲染出来。
 */
const CACHE = 'offmate-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API 一律走网络，不进缓存
  if (url.pathname.startsWith('/api')) return
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // 导航请求：网络优先，断网时回落到缓存的 index.html，
  // 这样直接打开 /schedule 这类前端路由在离线时也能进得去
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
    )
    return
  }

  // 静态资源：缓存优先。Vite 产物带内容哈希，更新会换文件名，不存在读到旧版的问题
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

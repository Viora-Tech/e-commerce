/*
 * Koomerce admin push service worker (Account → Notifications → Push).
 * Shows each staff push the worker sends (`packages/core/src/push/deliver.ts`, payload
 * { title, body, url, tag, storeId }) and, on a tap, focuses an open admin tab on that page or
 * opens one. It caches nothing and handles no fetches: the admin always loads from the network.
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Koomerce'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: '/brand/push-icon.png',
      badge: '/brand/push-badge.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url || '/'
  // Only ever a page of this admin: a push can never send the browser somewhere else.
  const target = new URL(path.startsWith('/') ? path : '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(target).then((c) => (c || client).focus())
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

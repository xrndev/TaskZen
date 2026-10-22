/* TaskZen: service worker solo para notificaciones push. No guarda páginas en caché a propósito:
   así nunca puede dejar a nadie con una versión antigua de la app. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  // Cada push debe mostrar una notificación (obligatorio en iOS y Chrome para userVisibleOnly).
  event.waitUntil(
    self.registration.showNotification(data.title || 'TaskZen', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || undefined,
      data: { url: typeof data.url === 'string' ? data.url : '/board' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Solo rutas de este mismo origen: un aviso nunca puede abrir otra web.
  const target = new URL(event.notification.data?.url || '/board', self.location.origin)
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/board'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      if (open) {
        if ('navigate' in open) open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})

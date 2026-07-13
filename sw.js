self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Trackline', body: 'You have a task due.', track: 'college' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  const trackLabel = data.track === 'build' ? 'Skill-build' : data.track === 'personal' ? 'Personal' : 'College';
  event.waitUntil(
    self.registration.showNotification(data.title || 'Trackline', {
      body: data.body || `${trackLabel} · due now`,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'trackline-task',
      renotify: true,
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const hadWindow = clientsArr.find((c) => c.url.includes(self.registration.scope));
      if (hadWindow) return hadWindow.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

/* Firebase messaging service worker — handles background push */
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCO1peBn79UVHpYsB_Yi30CEBVQXK4A_uY",
  authDomain: "ember-21aa3.firebaseapp.com",
  projectId: "ember-21aa3",
  storageBucket: "ember-21aa3.firebasestorage.app",
  messagingSenderId: "918527882127",
  appId: "1:918527882127:web:ab29c34b6156412e6c11fa",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Ember";
  const options = {
    body: payload.notification?.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        // Focus an existing window if open, else open a new one.
        for (const client of list) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow("/");
      }),
  );
});

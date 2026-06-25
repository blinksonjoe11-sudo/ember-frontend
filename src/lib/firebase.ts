import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, Messaging } from "firebase/messaging";

// From Firebase console → Project Settings → Your apps → Web app config.
const firebaseConfig = {
 apiKey: "AIzaSyCO1peBn79UVHpYsB_Yi30CEBVQXK4A_uY",
  authDomain: "ember-21aa3.firebaseapp.com",
  projectId: "ember-21aa3",
  storageBucket: "ember-21aa3.firebasestorage.app",
  messagingSenderId: "918527882127",
  appId: "1:918527882127:web:ab29c34b6156412e6c11fa",
};

// From Project Settings → Cloud Messaging → Web Push certificates.
const VAPID_KEY = "BA7qFmQhrxu2cp_qsf3FPyi5q0raYj6ShFmYqNlw3_nfksFknCHAUW1g6dpMWCBazlKuniITC7pDjw_9LoVMWYw";

const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;

export async function getWebMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!(await isSupported())) return null;
  messaging = getMessaging(app);
  return messaging;
}

// Requests notification permission, registers the service worker, and returns
// an FCM web token. Returns null if unsupported or denied.
export async function getWebPushToken(): Promise<string | null> {
  const m = await getWebMessaging();
  if (!m) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  try {
    const token = await getToken(m, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch {
    return null;
  }
}

// Foreground messages (app open). Returns an unsubscribe fn.
export async function onForegroundMessage(cb: (payload: any) => void) {
  const m = await getWebMessaging();
  if (!m) return () => {};
  return onMessage(m, cb);
}
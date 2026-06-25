import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { deviceApi } from "../api/endpoints";
import { getWebPushToken, onForegroundMessage } from "./firebase";

// registerPush wires up push on whatever platform we're running:
//   - Native (Capacitor on iOS/Android): uses the native FCM plugin.
//   - Web (PWA / browser): uses Firebase web messaging + service worker.
// Either way the token is sent to /api/devices so the backend can push to it.
export async function registerPush() {
  if (Capacitor.isNativePlatform()) {
    await registerNative();
  } else {
    await registerWeb();
  }
}

async function registerNative() {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    try {
      await deviceApi.register(token.value, Capacitor.getPlatform());
    } catch {
      /* retried next login */
    }
  });

  PushNotifications.addListener("registrationError", () => {});
}

async function registerWeb() {
  try {
    const token = await getWebPushToken();
    if (!token) return;
    await deviceApi.register(token, "web");

    // Foreground notifications (browser tab focused) — show a lightweight alert.
    onForegroundMessage((payload) => {
      const title = payload?.notification?.title || "Ember";
      const body = payload?.notification?.body || "";
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icons/icon-192.png" });
      }
    });
  } catch {
    /* push not available; non-fatal */
  }
}
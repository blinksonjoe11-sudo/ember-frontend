import { Preferences } from "@capacitor/preferences";

// Token storage. Capacitor Preferences uses native secure-ish storage on device
// and localStorage on web, so the same code works in `npm run dev` and on Android.

const ACCESS = "ember.accessToken";
const REFRESH = "ember.refreshToken";

export async function setTokens(access: string, refresh: string) {
  await Preferences.set({ key: ACCESS, value: access });
  await Preferences.set({ key: REFRESH, value: refresh });
}

export async function getAccess(): Promise<string | null> {
  const { value } = await Preferences.get({ key: ACCESS });
  return value;
}

export async function getRefresh(): Promise<string | null> {
  const { value } = await Preferences.get({ key: REFRESH });
  return value;
}

export async function clearTokens() {
  await Preferences.remove({ key: ACCESS });
  await Preferences.remove({ key: REFRESH });
}

import { getAccess, getRefresh, setTokens, clearTokens } from "../lib/tokens";

export const API_BASE = import.meta.env.VITE_API_BASE || "https://ember-u0r4.onrender.com";
export const WS_BASE = import.meta.env.VITE_WS_BASE || "wss://ember-u0r4.onrender.com";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Called when refresh fails and the session is dead. Wired up by AuthContext.
let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(fn: () => void) {
  onAuthLost = fn;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Collapse concurrent 401s into a single refresh call.
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = await getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: any;
  auth?: boolean;
  isForm?: boolean;
}

export async function api<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, isForm = false } = opts;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!isForm) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = await getAccess();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // On 401, attempt one refresh then retry once.
  if (res.status === 401 && auth) {
    const ok = await tryRefresh();
    if (ok) {
      res = await doFetch();
    } else {
      await clearTokens();
      onAuthLost?.();
      throw new ApiError(401, "session expired");
    }
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `request failed (${res.status})`, data);
  }
  return data as T;
}

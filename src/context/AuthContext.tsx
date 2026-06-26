import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { authApi } from "../api/endpoints";
import { setAuthLostHandler } from "../api/client";
import { setTokens, clearTokens, getAccess } from "../lib/tokens";
import type { AuthResult, User } from "../api/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  setSession: (r: AuthResult) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      /* keep stale user */
    }
  }, []);

  // When the API client gives up on refreshing, drop the session.
  useEffect(() => {
    setAuthLostHandler(() => {
      setUser(null);
    });
  }, []);

  // On boot, if we have a token, fetch the current user.
  useEffect(() => {
    (async () => {
      const token = await getAccess();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await authApi.me();
        setUser(user);
      } catch {
        await clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refetch the current user whenever the app regains focus or becomes visible,
  // so server-side changes (e.g. an admin approving a plug) appear without
  // needing to log out and back in.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        refreshUser();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUser]);

  const setSession = useCallback(async (r: AuthResult) => {
    await setTokens(r.accessToken, r.refreshToken);
    setUser(r.user);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, setSession, refreshUser, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
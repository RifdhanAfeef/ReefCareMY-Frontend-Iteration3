"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "@/lib/api/authApi";
import { AUTH_INVALIDATED_EVENT, readStoredAuth, writeStoredAuth } from "@/lib/api/token-store";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const clearSession = () => {
      if (cancelled) return;
      setUser(null);
      setAccessToken(null);
      setStatus("unauthenticated");
      writeStoredAuth(null);
    };
    window.addEventListener(AUTH_INVALIDATED_EVENT, clearSession);

    const stored = readStoredAuth();
    if (stored) {
      authApi.getCurrentUser()
        .then((currentUser) => {
          if (cancelled) return;
          setUser(currentUser);
          setAccessToken(stored.accessToken);
          setStatus("authenticated");
          writeStoredAuth({ user: currentUser, accessToken: stored.accessToken });
        })
        .catch((error) => {
          if (cancelled) return;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            clearSession();
            return;
          }
          // A temporary connection failure should not erase a valid local session.
          setUser(stored.user);
          setAccessToken(stored.accessToken);
          setStatus("authenticated");
        });
    } else {
      queueMicrotask(() => {
        if (!cancelled) setStatus("unauthenticated");
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_INVALIDATED_EVENT, clearSession);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setUser(result.user);
    setAccessToken(result.accessToken);
    setStatus("authenticated");
    writeStoredAuth({ user: result.user, accessToken: result.accessToken });
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    // The backend uses stateless bearer tokens and does not expose a logout route.
    // Signing out is therefore a local session operation: remove the stored token
    // and immediately return the interface to its unauthenticated state.
    setUser(null);
    setAccessToken(null);
    setStatus("unauthenticated");
    writeStoredAuth(null);
  }, []);

  const value = useMemo(
    () => ({ status, user, accessToken, login, logout }),
    [status, user, accessToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}

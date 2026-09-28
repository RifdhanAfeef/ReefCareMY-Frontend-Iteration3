import type { AuthUser } from "./types";

const STORAGE_KEY = "reefcare.auth";
export const AUTH_INVALIDATED_EVENT = "reefcare:auth-invalidated";

export type StoredAuth = {
  user: AuthUser;
  accessToken: string;
};

export function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function writeStoredAuth(value: StoredAuth | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function invalidateStoredAuth(): void {
  writeStoredAuth(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT));
  }
}

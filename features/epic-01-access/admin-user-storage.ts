import type { UserAccount } from "./types";

const STORAGE_KEY = "reefcare.admin-created-users";

export function readCreatedUsers(): UserAccount[] {
  if (typeof window === "undefined") return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const users = JSON.parse(stored);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

export function saveCreatedUser(user: UserAccount): void {
  const currentUsers = readCreatedUsers();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...currentUsers, user]));
}

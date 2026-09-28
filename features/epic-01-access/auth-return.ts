import type { UserRole } from "@/lib/api/types";

const roleReturnPrefixes: Record<UserRole, readonly string[]> = {
  observer: ["/report-a-reef", "/my-reports"],
  case_coordinator: ["/coordinator"],
  system_administrator: ["/admin"],
};

export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value)) return null;

  try {
    const url = new URL(value, "https://reefcare.local");
    if (url.origin !== "https://reefcare.local") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function returnPathForRole(value: string | null, role: UserRole): string | null {
  const path = safeReturnPath(value);
  if (!path) return null;

  return roleReturnPrefixes[role].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  )
    ? path
    : null;
}

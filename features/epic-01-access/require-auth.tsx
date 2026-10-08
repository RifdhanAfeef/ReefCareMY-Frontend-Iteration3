"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import type { UserRole } from "@/lib/api/types";
import styles from "./require-auth.module.css";

function currentReturnPath(pathname: string) {
  const search = typeof window === "undefined" ? "" : window.location.search;
  return `${pathname}${search}`;
}

// While the session is checked (or a redirect is under way) keep the page from
// flashing blank: say what is happening in the space the page will occupy.
function CheckingAccess() {
  return (
    <div className={styles.checking} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Checking your sign-in…</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(currentReturnPath(pathname))}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return <CheckingAccess />;
  }

  return <>{children}</>;
}

const roleHome: Record<UserRole, string> = {
  observer: "/my-reports",
  case_coordinator: "/coordinator/report-queue",
  system_administrator: "/admin/users",
};

export function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(currentReturnPath(pathname))}`);
      return;
    }

    if (status === "authenticated" && user?.role !== role) {
      router.replace(user ? roleHome[user.role] : "/");
    }
  }, [status, user, role, pathname, router]);

  if (status !== "authenticated" || user?.role !== role) {
    return <CheckingAccess />;
  }

  return <>{children}</>;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { HeaderAction, NavigationItem } from "@/config/navigation";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { clearSelectedReefSite } from "@/features/epic-02-reef-explorer/selected-site-storage";
import { clearDraftPhotos } from "@/features/epic-02-reporting/draft-storage";
import { useMockAppState } from "@/features/shared/mock-app-state";
import { Brand } from "./brand";
import styles from "./site-header.module.css";

type SiteHeaderProps = {
  navigation: NavigationItem[];
  actions?: HeaderAction[];
  identity?: {
    label: string;
    initial: string;
  };
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function FreshReportLink({ item, active }: { item: NavigationItem; active: boolean }) {
  const router = useRouter();
  const { resetReportDraft } = useMockAppState();

  async function startNewReport(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    resetReportDraft();
    clearSelectedReefSite();
    await clearDraftPhotos().catch(() => undefined);
    router.push("/report-a-reef");
    router.refresh();
  }

  return (
    <Link
      className={`${styles.navLink} ${active ? styles.active : ""}`}
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={startNewReport}
    >
      {item.label}
    </Link>
  );
}

export function SiteHeader({
  navigation,
  actions = [],
  identity,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const resolvedIdentity = identity ?? (user
    ? { label: user.displayName.trim() || "Signed-in user", initial: user.displayName.trim().charAt(0).toUpperCase() || "U" }
    : undefined);

  async function signOut() {
    await logout();
    router.push("/");
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Brand />

        <nav className={styles.navigation} aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            if (item.href === "/report-a-reef") {
              return <FreshReportLink key={item.href} item={item} active={active} />;
            }
            return (
              <Link
                key={item.href}
                className={`${styles.navLink} ${active ? styles.active : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {(resolvedIdentity || actions.length > 0) && (
          <div className={styles.actions}>
            {resolvedIdentity && (
              <div className={styles.identity} aria-label={`Signed in as ${resolvedIdentity.label}`}>
                <span>{resolvedIdentity.label}</span>
                <span className={styles.avatar} aria-hidden="true">
                  {resolvedIdentity.initial}
                </span>
              </div>
            )}
            {actions.map((action) => action.label === "Log out" ? (
              <button
                key={`${action.href}-${action.label}`}
                className={`${styles.action} ${styles[action.variant]}`}
                type="button"
                onClick={signOut}
              >
                {action.label}
              </button>
            ) : (
              <Link
                key={`${action.href}-${action.label}`}
                className={`${styles.action} ${styles[action.variant]}`}
                href={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { HeaderAction, NavigationItem } from "@/config/navigation";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { clearSelectedReefSite } from "@/features/epic-02-reef-explorer/selected-site-storage";
import { hasReportInProgress } from "@/features/epic-02-reporting/draft-progress";
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

function FreshReportLink({ item, active, className }: { item: NavigationItem; active: boolean; className?: string }) {
  const router = useRouter();
  const { reportDraft, locationDraft, isAccountDraftRestored, resetReportDraft } = useMockAppState();
  const [choosing, setChoosing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");
  const linkRef = useRef<HTMLAnchorElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const photoCount = reportDraft.photos.length;

  useEffect(() => {
    if (choosing) continueRef.current?.focus();
  }, [choosing]);

  function closeChoice() {
    setChoosing(false);
    setDiscardError("");
    linkRef.current?.focus();
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !discarding) {
      closeChoice();
      return;
    }
    if (event.key !== "Tab") return;
    // Keep focus on the two choices while the dialog is open.
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openReportForm() {
    router.push("/report-a-reef");
    router.refresh();
  }

  function clearReportState() {
    resetReportDraft();
    clearSelectedReefSite();
  }

  async function handleNavigation(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    // Until the account draft has been read, an empty draft only means "not
    // loaded yet". Open the form without clearing anything so nothing is lost.
    if (!isAccountDraftRestored) {
      openReportForm();
      return;
    }
    if (hasReportInProgress(reportDraft, locationDraft)) {
      setDiscardError("");
      setChoosing(true);
      return;
    }
    clearReportState();
    await clearDraftPhotos().catch(() => undefined);
    openReportForm();
  }

  function continueDraft() {
    setChoosing(false);
    openReportForm();
  }

  async function discardDraft() {
    setDiscarding(true);
    setDiscardError("");
    try {
      // Clear the stored photos first so a storage failure leaves the draft intact.
      await clearDraftPhotos();
      clearReportState();
      setChoosing(false);
      openReportForm();
    } catch {
      setDiscardError("Your saved report could not be cleared from this device. Please try again.");
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <>
      <Link
        ref={linkRef}
        className={className ?? `${styles.navLink} ${active ? styles.active : ""}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={handleNavigation}
      >
        {item.label}
      </Link>
      {choosing && createPortal(
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onKeyDown={handleDialogKeys}
          onMouseDown={(event) => { if (event.target === event.currentTarget && !discarding) closeChoice(); }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-choice-heading"
            aria-describedby="draft-choice-description"
          >
            <h2 id="draft-choice-heading">You have a report in progress</h2>
            <p id="draft-choice-description">
              {photoCount > 0
                ? `Your unsubmitted report and ${photoCount} photo${photoCount === 1 ? "" : "s"} are saved on this device. `
                : "Your unsubmitted report is saved on this device. "}
              Pick up where you left off, or discard it to start again.
            </p>
            {discardError && <p className={styles.dialogError} role="alert">{discardError}</p>}
            <div className={styles.dialogActions}>
              <button className={styles.dialogDanger} type="button" disabled={discarding} onClick={discardDraft}>
                {discarding ? "Discarding…" : "Discard and start new"}
              </button>
              <button ref={continueRef} className={styles.dialogPrimary} type="button" disabled={discarding} onClick={continueDraft}>
                Continue report
              </button>
            </div>
          </section>
        </div>,
        // The sticky header's backdrop-filter would otherwise contain this fixed overlay.
        document.body,
      )}
    </>
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
  const navigationRef = useRef<HTMLElement>(null);
  const reportItem = navigation.find((item) => item.href === "/report-a-reef");

  // On narrow screens the navigation scrolls sideways; keep the current page in view.
  useEffect(() => {
    navigationRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const resolvedIdentity = identity ?? (user
    ? { label: user.displayName.trim() || "Signed-in user", initial: user.displayName.trim().charAt(0).toUpperCase() || "U" }
    : undefined);

  async function signOut() {
    await logout();
    router.push("/");
  }

  return (
    <header className={styles.header}>
      <div className={`${styles.inner} ${resolvedIdentity ? styles.signedIn : ""}`}>
        <Brand />

        <nav className={styles.navigation} aria-label="Primary navigation" ref={navigationRef}>
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

        {(resolvedIdentity || actions.length > 0 || reportItem) && (
          <div className={styles.actions}>
            {reportItem && (
              <FreshReportLink
                item={{ ...reportItem, label: "Report" }}
                active={false}
                className={styles.quickReport}
              />
            )}
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

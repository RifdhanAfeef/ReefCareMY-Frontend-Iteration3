import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./hotspots.module.css";

export function HotspotLoading({ message = "Loading geographic reporting activity…" }: { message?: string }) {
  return <div className={styles.loading} role="status"><span className={styles.spinner} aria-hidden="true" />{message}</div>;
}

export function HotspotError({ error, onRetry, title = "Analysis unavailable" }: { error: unknown; onRetry: () => void; title?: string }) {
  return <div className={styles.error} role="alert">
    <strong>{title}</strong>
    <p>{userFacingError(error, "Reporting activity could not be loaded. Please try again.")}</p>
    <div className={styles.actions}>
      <button className={styles.secondaryButton} type="button" onClick={onRetry}>Try again</button>
      {error instanceof ApiError && error.status === 401 && <Link className={styles.secondaryButton} href="/login">Log in</Link>}
      <Link className={styles.textLink} href="/coordinator/report-queue">Open report intake</Link>
    </div>
  </div>;
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format/date";
import styles from "./report-confirmation.module.css";

function capitalize(value: string) {
  const readable = value.replace(/[_-]+/g, " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function displaySubmittedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

export function ReportConfirmation() {
  const searchParams = useSearchParams();

  const reportReference = searchParams.get("reportReference");
  const status = searchParams.get("status");
  const submittedAt = searchParams.get("submittedAt");
  const generalLocation = searchParams.get("generalLocation");
  const threatCategory = searchParams.get("threatCategory");

  if (!reportReference || !status || !submittedAt || !generalLocation || !threatCategory) {
    return (
      <section className={styles.fallbackCard}>
        <span className={styles.fallbackIcon} aria-hidden="true">i</span>
        <h2>Submission details unavailable</h2>
        <p>We don&apos;t have your submission details here. You can find your submitted reports and their latest status in My Reports.</p>
        <Link className={styles.primaryAction} href="/my-reports">Go to My Reports</Link>
      </section>
    );
  }

  return (
    <section className={styles.confirmation} aria-label="Submitted report confirmation">
      <header className={styles.successHeader}>
        <span className={styles.successIcon} aria-hidden="true">✓</span>
        <div className={styles.successCopy}>
          <span>Submission complete</span>
          <h2>Your report has been safely recorded</h2>
          <p>Keep the report reference below if you need to find or discuss this observation later.</p>
        </div>
        <span className={styles.statusBadge}>{capitalize(status)}</span>
      </header>

      <div className={styles.contentGrid}>
        <section className={styles.summaryPanel} aria-labelledby="report-summary-heading">
          <div className={styles.referenceBlock}>
            <span>Report reference</span>
            <strong>{reportReference}</strong>
          </div>
          <h3 id="report-summary-heading">Report summary</h3>
          <dl className={styles.summary}>
            <div className={styles.row}>
              <dt>Possible threat type</dt>
              <dd>{threatCategory}</dd>
            </div>
            <div className={styles.row}>
              <dt>General location</dt>
              <dd>{generalLocation}</dd>
            </div>
            <div className={styles.row}>
              <dt>Submitted</dt>
              <dd><time dateTime={submittedAt}>{displaySubmittedAt(submittedAt)}</time></dd>
            </div>
          </dl>
        </section>

        <aside className={styles.nextSteps} aria-labelledby="next-steps-heading">
          <h3 id="next-steps-heading">What happens next?</h3>
          <ol>
            <li>
              <span aria-hidden="true">1</span>
              <div><strong>Coordinator review</strong><p>A Case Coordinator will review the information and evidence you submitted.</p></div>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <div><strong>Follow the report</strong><p>Check My Reports for status updates or a request for more information.</p></div>
            </li>
          </ol>
        </aside>
      </div>

      <footer className={styles.actions}>
        <Link className={styles.primaryAction} href={`/my-reports/${encodeURIComponent(reportReference)}`}>View this report</Link>
        <Link className={styles.secondaryAction} href="/report-a-reef">Report another observation</Link>
        <Link className={styles.textAction} href="/my-reports">Go to My Reports</Link>
      </footer>
    </section>
  );
}


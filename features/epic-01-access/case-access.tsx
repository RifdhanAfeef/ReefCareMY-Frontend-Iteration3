import Link from "next/link";
import type { CaseRecord } from "./types";
import { StatusPill } from "./status-pill";
import styles from "./access-ui.module.css";

export function MyCaseList({ cases }: { cases: CaseRecord[] }) {
  if (cases.length === 0) {
    return (
      <section className={styles.card}>
        <div className={styles.emptyState}>
          <h2 className={styles.sectionHeading}>No active cases</h2>
          <p>You have not claimed any submitted reports.</p>
          <Link className={styles.primaryButton} href="/coordinator/report-queue">
            Open report queue
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tableCard} aria-label="Cases owned by this coordinator">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Threat</th>
              <th scope="col">General area</th>
              <th scope="col">Claimed</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.reportReference}>
                <td className={styles.identifier}>{item.reportReference}</td>
                <td>{item.threat}</td>
                <td>{item.generalLocation}</td>
                <td>{item.claimedAt}</td>
                <td>
                  <StatusPill status={item.statusLabel} />
                </td>
                <td>
                  <Link
                    className={styles.textButton}
                    href={`/coordinator/reports/${item.reportReference}`}
                  >
                    View case activity
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RestrictedCase({ record }: { record: CaseRecord }) {
  return (
    <section className={styles.restrictionCard}>
      <div className={styles.warningIcon} aria-hidden="true">
        !
      </div>
      <h2>Report {record.reportReference} is already claimed</h2>
      <p className={styles.sectionDescription}>
        Current owner: {record.owner} · Claimed {record.claimedAt}
      </p>

      <div className={styles.warningNotice}>
        <strong>Sensitive details remain restricted</strong>
        The exact location and coordinator decision controls are available only to
        the active case owner.
      </div>

      <div className={styles.buttonRow}>
        <Link className={styles.secondaryButton} href="/coordinator/report-queue">
          Return to queue
        </Link>
        <span className={styles.notice}>General status: {record.statusLabel}</span>
      </div>
    </section>
  );
}

export function UnclaimedCase({ record }: { record: CaseRecord }) {
  return (
    <section className={styles.restrictionCard}>
      <div className={styles.warningIcon} aria-hidden="true">
        !
      </div>
      <h2>Report {record.reportReference} has not been claimed</h2>
      <p className={styles.sectionDescription}>
        Return to Report Intake to claim this report before opening its protected
        details.
      </p>
      <div className={styles.warningNotice}>
        <strong>Protected details are not shown yet</strong>
        Your case ownership must be verified before the exact location or decision
        controls become available.
      </div>
      <Link className={styles.primaryButton} href="/coordinator/report-queue">
        Return to report intake
      </Link>
    </section>
  );
}

export function CaseOwnerActivity({ record }: { record: CaseRecord }) {
  return (
    <div className={styles.caseGrid}>
      <section className={styles.detailCard} aria-labelledby="case-activity-title">
        <div className={styles.summaryRow}>
          <div>
            <h2 className={styles.sectionHeading} id="case-activity-title">
              Report {record.reportReference}
            </h2>
            <p className={styles.sectionDescription}>
              {record.threat} · {record.generalLocation}
            </p>
          </div>
          <StatusPill status={record.statusLabel} />
        </div>

        <div className={styles.ownerBanner}>
          <strong>Active owner</strong>
          <div>
            {record.owner} claimed this report on {record.claimedAt}.
          </div>
        </div>

        <dl className={styles.definitionList}>
          <div>
            <dt>Submitted by</dt>
            <dd>{record.submittedBy}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{record.submittedAt}</dd>
          </div>
          <div>
            <dt>General area</dt>
            <dd>{record.generalLocation}</dd>
          </div>
          <div>
            <dt>Authorised exact location</dt>
            <dd>{record.exactLocation ?? "No exact coordinates submitted"}</dd>
          </div>
        </dl>

        <h3 className={styles.sectionHeading}>Key activity</h3>
        <ol className={styles.activityList}>
          {record.activity.map((entry) => (
            <li className={styles.activityItem} key={entry.id}>
              <span className={styles.activityDot} aria-hidden="true" />
              <div>
                <p className={styles.activityTitle}>{entry.action}</p>
                <span className={styles.activityMeta}>By {entry.actor}</span>
              </div>
              <time className={styles.activityTime}>{entry.timestamp}</time>
            </li>
          ))}
        </ol>
      </section>

      <aside className={styles.permissions} aria-labelledby="access-summary-title">
        <h2 className={styles.sectionHeading} id="access-summary-title">
          Access summary
        </h2>
        <ul className={styles.permissionList}>
          <li className={styles.permissionItem}>
            <span className={styles.check} aria-hidden="true">✓</span>
            <span>Claimed case details</span>
          </li>
          <li className={styles.permissionItem}>
            <span className={styles.check} aria-hidden="true">✓</span>
            <span>Exact submitted location</span>
          </li>
          <li className={styles.permissionItem}>
            <span className={styles.check} aria-hidden="true">✓</span>
            <span>Decision controls</span>
          </li>
          <li className={styles.permissionItem}>
            <span className={styles.emptyCheck} aria-hidden="true" />
            <span>Other observers’ reports</span>
          </li>
          <li className={styles.permissionItem}>
            <span className={styles.emptyCheck} aria-hidden="true" />
            <span>Administrator-only settings</span>
          </li>
        </ul>

        <div className={styles.privacyNotice}>
          <strong>Activity is recorded</strong>
          Ownership and decision changes include the responsible user and timestamp.
        </div>
      </aside>
    </div>
  );
}

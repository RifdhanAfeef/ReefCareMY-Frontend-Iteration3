"use client";

import { useState } from "react";
import Link from "next/link";
import type { AccessRequest } from "./types";
import { getUserRoleLabel } from "./role-catalog";
import styles from "./access-ui.module.css";

const grantedPermissions = [
  "View the coordination queue",
  "Claim one report as active owner",
  "Review claimed report details",
  "Record decisions and closure reasons",
];

const restrictedPermissions = [
  "View every exact location",
  "Open another coordinator’s claimed case",
  "Act as a System Administrator",
];

export function AccessRequestReview({ request }: { request: AccessRequest }) {
  const [note, setNote] = useState(
    "Approved for Case Coordinator access. Sensitive case information becomes available only after a report is claimed.",
  );
  const [decision, setDecision] = useState<"Approved" | "Rejected" | null>(null);

  if (decision) {
    const approved = decision === "Approved";
    return (
      <section className={styles.successCard} aria-live="polite">
        <div className={approved ? styles.successIcon : styles.warningIcon}>
          {approved ? "✓" : "!"}
        </div>
        <h2>
          {approved
            ? `${request.userName} is now a Case Coordinator`
            : `Coordinator access was not approved`}
        </h2>
        <p className={styles.sectionDescription}>
          This is a preview only. The account’s access has not been changed.
        </p>

        <div className={styles.traceRecord}>
          <strong>Preview traceability record</strong>
          <div className={styles.summaryRow}>
            <span>Changed by: Admin User</span>
            <span>28/08/2026, 2:40 PM</span>
          </div>
          <p className={styles.muted}>Decision: {decision} · Request {request.id}</p>
        </div>

        <div className={styles.buttonRow}>
          <Link className={styles.secondaryButton} href="/admin/users">
            Back to users
          </Link>
          <Link className={styles.primaryButton} href="/admin/role-requests">
            Review other requests
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.reviewGrid}>
      <section className={styles.detailCard} aria-labelledby="request-title">
        <div className={styles.notice} role="status">
          <strong>Access changes are not available yet</strong>
          You can review this request, but changes cannot be applied to the account
          from this screen.
        </div>
        <h2 className={styles.sectionHeading} id="request-title">
          Access request
        </h2>
        <p className={styles.sectionDescription}>
          Requested role: {getUserRoleLabel(request.requestedRole)}
        </p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="request-user">User</label>
            <input
              className={styles.input}
              id="request-user"
              value={request.userName}
              readOnly
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="request-email">Email</label>
            <input
              className={styles.input}
              id="request-email"
              value={request.email}
              readOnly
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="current-role">Current role</label>
            <input
              className={styles.input}
              id="current-role"
              value={getUserRoleLabel(request.currentRole)}
              readOnly
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="requested-role">Requested role</label>
            <input
              className={styles.input}
              id="requested-role"
              value={getUserRoleLabel(request.requestedRole)}
              readOnly
            />
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label htmlFor="approval-note">Decision note</label>
            <textarea
              className={styles.textarea}
              id="approval-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button
            className={styles.dangerButton}
            type="button"
            disabled={!note.trim()}
            onClick={() => setDecision("Rejected")}
          >
            Reject
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!note.trim()}
            onClick={() => setDecision("Approved")}
          >
            Approve coordinator
          </button>
        </div>
      </section>

      <aside className={styles.permissions} aria-labelledby="permission-title">
        <h2 className={styles.sectionHeading} id="permission-title">
          Permission summary
        </h2>
        <ul className={styles.permissionList}>
          {grantedPermissions.map((permission) => (
            <li className={styles.permissionItem} key={permission}>
              <span className={styles.check} aria-hidden="true">
                ✓
              </span>
              <span>{permission}</span>
            </li>
          ))}
        </ul>
        <div className={styles.permissionDivider} />
        <p className={styles.notGranted}>Not automatically granted</p>
        <ul className={styles.permissionList}>
          {restrictedPermissions.map((permission) => (
            <li className={styles.permissionItem} key={permission}>
              <span className={styles.emptyCheck} aria-hidden="true" />
              <span>{permission}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

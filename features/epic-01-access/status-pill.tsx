import styles from "./access-ui.module.css";

type StatusPillProps = {
  status: string;
};

const styleByStatus: Record<string, string> = {
  active: styles.pillActive,
  approved: styles.pillApproved,
  claimed: styles.pillReviewing,
  "under review": styles.pillReviewing,
  "being reviewed": styles.pillReviewing,
  "evidence accepted": styles.pillReviewing,
  "response recommended": styles.pillReviewing,
  "response planned": styles.pillPending,
  "response complete": styles.pillApproved,
  monitoring: styles.pillReviewing,
  referred: styles.pillReviewing,
  pending: styles.pillPending,
  received: styles.pillReceived,
  rejected: styles.pillRejected,
  suspended: styles.pillSuspended,
};

export function StatusPill({ status }: StatusPillProps) {
  const statusStyle = styleByStatus[status.trim().toLowerCase()] ?? "";

  return (
    <span className={`${styles.pill} ${statusStyle}`}>
      {status}
    </span>
  );
}

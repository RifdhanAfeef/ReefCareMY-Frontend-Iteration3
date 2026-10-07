import styles from "./reporting.module.css";

const reportSteps = ["Observation", "Dive & location", "Review & submit"] as const;

/** The one progress model for the whole report journey, shown on every step. */
export function ReportProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className={styles.reportProgress} aria-label="Report progress">
      {reportSteps.map((label, index) => {
        const step = index + 1;
        const status = step < current ? "complete" : step === current ? "current" : "upcoming";
        return (
          <li key={label} aria-current={status === "current" ? "step" : undefined} data-status={status}>
            <span aria-hidden="true">{status === "complete" ? "✓" : step}</span>
            <strong>{label}{status === "complete" && <span className="sr-only"> (done)</span>}</strong>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import type { CaseRecord } from "./types";
import { StatusPill } from "./status-pill";
import styles from "./access-ui.module.css";

type ReportQueueProps = {
  initialCases: CaseRecord[];
  currentCoordinator: string;
};

export function ReportQueue({
  initialCases,
  currentCoordinator,
}: ReportQueueProps) {
  const [queue, setQueue] = useState(initialCases);
  const [message, setMessage] = useState("");

  function claimCase(reportId: string) {
    setQueue((current) =>
      current.map((item) => {
        if (item.reportReference !== reportId || item.owner) return item;
        return {
          ...item,
          owner: currentCoordinator,
          claimedAt: "28/08/2026, 2:45 PM",
          statusCode: "claimed",
          statusLabel: "Claimed",
          activity: [
            ...item.activity,
            {
              id: `ACT-${item.reportReference}-CLAIM`,
              action: "Case claimed",
              actor: currentCoordinator,
              timestamp: "28/08/2026, 2:45 PM",
            },
          ],
        };
      }),
    );
    setMessage(
      `${reportId} is shown as assigned to ${currentCoordinator} in this preview. The live case record has not been changed.`,
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.notice}>
        <strong>One active owner per case</strong>
        Claiming a report records the coordinator and time. Reports already claimed
        by someone else cannot be claimed again.
      </section>

      {message && (
        <p className={styles.notice} role="status">
          {message}
        </p>
      )}

      <section className={styles.tableCard} aria-label="Submitted report queue">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Report</th>
                <th scope="col">Threat</th>
                <th scope="col">General area</th>
                <th scope="col">Status</th>
                <th scope="col">Owner</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.reportReference}>
                  <td className={styles.identifier}>{item.reportReference}</td>
                  <td>{item.threat}</td>
                  <td>{item.generalLocation}</td>
                  <td>
                    <StatusPill status={item.statusLabel} />
                  </td>
                  <td>{item.owner ?? "Unclaimed"}</td>
                  <td>
                    {!item.owner ? (
                      <button
                        className={styles.textButton}
                        type="button"
                        onClick={() => claimCase(item.reportReference)}
                      >
                        Claim report
                      </button>
                    ) : item.owner === currentCoordinator &&
                      item.claimedAt !== "28/08/2026, 2:45 PM" ? (
                      <Link
                        className={styles.textButton}
                        href={`/coordinator/reports/${item.reportReference}`}
                      >
                        Open my case
                      </Link>
                    ) : item.owner === currentCoordinator ? (
                      <span className={styles.muted}>Claimed in this demo</span>
                    ) : (
                      <Link
                        className={styles.textButton}
                        href={`/coordinator/reports/${item.reportReference}`}
                      >
                        View access notice
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

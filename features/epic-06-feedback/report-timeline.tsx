"use client";

import { useEffect, useState } from "react";
import { getReportTimeline } from "@/lib/api/reportsApi";
import type { ReportTimelineEvent } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { formatDateTime } from "@/lib/format/date";
import styles from "./report-timeline.module.css";

type LoadState = "loading" | "loaded" | "error";

export function ReportTimeline({ reportReference }: { reportReference: string }) {
  const [events, setEvents] = useState<ReportTimelineEvent[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getReportTimeline(reportReference)
      .then((result) => {
        if (!cancelled) {
          setEvents(result.timeline);
          setState("loaded");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(userFacingError(err, "We couldn’t load this report’s status history right now."));
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reportReference, reloadKey]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ reportReference?: string }>).detail;
      if (!detail?.reportReference || detail.reportReference === reportReference) {
        setReloadKey((value) => value + 1);
      }
    };
    window.addEventListener("reefcare:report-updated", refresh);
    return () => window.removeEventListener("reefcare:report-updated", refresh);
  }, [reportReference]);

  if (state === "loading") {
    return <p>Loading status history…</p>;
  }

  if (state === "error") {
    return (
      <p role="alert">{error ?? "We couldn’t load this report’s status history right now."}</p>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="status-history-heading">
      <header className={styles.header}>
        <p>Progress</p>
        <h2 id="status-history-heading">Status history</h2>
        <span>The latest update is shown at the bottom.</span>
      </header>

      {events.length === 0 ? (
        <p className={styles.empty}>No status updates are available yet.</p>
      ) : (
        <ol className={styles.timeline}>
          {events.map((event, index) => (
            <li
              key={`${event.occurredAt}-${index}`}
              className={`${styles.step} ${index === events.length - 1 ? styles.current : ""}`}
            >
              <span className={styles.marker} aria-hidden="true" />
              <div>
                <p className={styles.label}>{event.statusLabel}</p>
                <time className={styles.date} dateTime={event.occurredAt}>
                  {formatDateTime(new Date(event.occurredAt))}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

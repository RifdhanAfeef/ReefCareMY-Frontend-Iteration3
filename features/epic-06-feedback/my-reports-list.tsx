"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyReports } from "@/lib/api/reportsApi";
import type { MyReportsResult } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./my-reports-list.module.css";

type LoadState = "loading" | "loaded" | "error";
const pageSize = 20;

export function MyReportsList() {
  const [result, setResult] = useState<MyReportsResult | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMyReports({ page, pageSize })
      .then((nextResult) => {
        if (!cancelled) {
          setResult(nextResult);
          setError(null);
          setState("loaded");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(userFacingError(err, "Your reports could not be loaded right now."));
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  function changePage(nextPage: number) {
    setState("loading");
    setError(null);
    setPage(nextPage);
  }

  function retry() {
    setState("loading");
    setError(null);
    setReloadKey((value) => value + 1);
  }

  if (state === "loading") {
    return <p>Loading your reports…</p>;
  }

  if (state === "error") {
    return (
      <section className={styles.message} role="alert">
        <strong>We couldn&apos;t load your reports</strong>
        <p>{error}</p>
        <button className={styles.button} type="button" onClick={retry}>Try again</button>
      </section>
    );
  }

  if (!result || result.items.length === 0) {
    return <p>You haven&apos;t submitted any reports yet.</p>;
  }

  const actualPageSize = result.pageSize || pageSize;
  const totalPages = Math.max(1, Math.ceil(result.total / actualPageSize));
  const firstItem = (page - 1) * actualPageSize + 1;
  const lastItem = Math.min(page * actualPageSize, result.total);

  return (
    <div>
      <ul className={styles.list}>
        {result.items.map((report) => (
          <li key={report.reportReference} className={styles.card}>
            <Link href={`/my-reports/${report.reportReference}`} className={styles.link}>
              <div className={styles.headline}>
                <span className={styles.reference}>{report.reportReference}</span>
                <span className={styles.status}>{report.statusLabel}</span>
              </div>
              <p className={styles.threat}>{report.threatCategory}</p>
              <p className={styles.location}>{report.generalLocation}</p>
              {report.outcome && <p className={styles.outcome}>{report.outcome}</p>}
              <time className={styles.date} dateTime={report.submittedAt}>
                Submitted {new Date(report.submittedAt).toLocaleDateString()}
              </time>
            </Link>
          </li>
        ))}
      </ul>

      <nav className={styles.pagination} aria-label="My reports pages">
        <p aria-live="polite">Showing {firstItem}–{lastItem} of {result.total} reports</p>
        <div>
          <button className={styles.button} type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className={styles.button} type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
        </div>
      </nav>
    </div>
  );
}

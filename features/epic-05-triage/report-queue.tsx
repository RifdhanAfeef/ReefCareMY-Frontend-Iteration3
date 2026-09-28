"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCoordinatorQueue } from "@/lib/api/coordinatorApi";
import type { CoordinatorQueueItem } from "@/lib/api/types";
import { readStoredAuth } from "@/lib/api/token-store";
import { userFacingError } from "@/lib/api/user-facing-error";
import { formatDateTime } from "@/lib/format/date";
import styles from "./triage.module.css";

const pageSize = 20;
const backendPageSize = 100;

type LoadState = "loading" | "loaded" | "error";

function waitingTime(hours?: number) {
  if (hours == null) return "—";
  if (hours < 1) return "Less than 1 hour";
  if (hours < 24) {
    const roundedHours = Math.max(1, Math.floor(hours));
    return `${roundedHours} ${roundedHours === 1 ? "hour" : "hours"}`;
  }
  if (hours < 24 * 7) {
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (hours < 24 * 30) {
    const weeks = Math.floor(hours / (24 * 7));
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  const months = Math.floor(hours / (24 * 30));
  return `${months} ${months === 1 ? "month" : "months"}`;
}

function submittedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

function newestFirst(left: CoordinatorQueueItem, right: CoordinatorQueueItem) {
  const leftTime = Date.parse(left.submittedAt);
  const rightTime = Date.parse(right.submittedAt);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return (left.hoursInQueue ?? Number.POSITIVE_INFINITY) - (right.hoursInQueue ?? Number.POSITIVE_INFINITY);
}

function areaLabel(area: string | null) {
  return area ?? "Not provided";
}

function humanise(value?: string | null, fallback = "Not provided") {
  if (!value) return fallback;
  return value.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function priorityKey(value?: string | null) {
  return (value ?? "not_set").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function loadAllQueueItems() {
  const firstResult = await getCoordinatorQueue(1, backendPageSize);
  const items = [...firstResult.items];
  const actualBackendPageSize = firstResult.pageSize || backendPageSize;
  const totalPages = Math.max(1, Math.ceil(firstResult.total / actualBackendPageSize));

  for (let backendPage = 2; backendPage <= totalPages; backendPage += 1) {
    const nextResult = await getCoordinatorQueue(backendPage, backendPageSize);
    items.push(...nextResult.items);
  }

  return Array.from(new Map(items.map((item) => [item.reportReference, item])).values());
}

export function ReportQueue() {
  const [items, setItems] = useState<CoordinatorQueueItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [site, setSite] = useState("all");
  const [ownership, setOwnership] = useState("unclaimed");
  const currentUserId = readStoredAuth()?.user.id;

  useEffect(() => {
    let cancelled = false;

    loadAllQueueItems()
      .then((queueItems) => {
        if (cancelled) return;
        setItems(queueItems);
        setState("loaded");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(userFacingError(requestError, "The report queue could not be loaded."));
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const sites = useMemo(
    () => Array.from(new Set(items.map((record) => areaLabel(record.area)))).sort(),
    [items],
  );
  const filteredReports = useMemo(
    () => items.filter((report) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query ||
        report.reportReference.toLowerCase().includes(query) ||
        report.threat.toLowerCase().includes(query);
      const matchesSite = site === "all" || areaLabel(report.area) === site;
      const isClaimed = Boolean(report.owner) || Boolean(report.claimedAt);
      const matchesOwnership = ownership === "all" ||
        (ownership === "unclaimed" && !isClaimed) ||
        (ownership === "mine" && report.owner?.id === currentUserId) ||
        (ownership === "claimed" && isClaimed);
      return matchesSearch && matchesSite && matchesOwnership;
    }).sort(newestFirst),
    [currentUserId, items, ownership, search, site],
  );

  const total = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const reports = filteredReports.slice(firstItem ? firstItem - 1 : 0, lastItem);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateSite(value: string) {
    setSite(value);
    setPage(1);
  }

  function updateOwnership(value: string) {
    setOwnership(value);
    setPage(1);
  }

  function retryLoad() {
    setState("loading");
    setError(null);
    setReloadKey((current) => current + 1);
  }

  return (
    <section className={styles.page}>
      <header className={`${styles.heading} ${styles.queuePageHeading}`}>
        <p className={styles.eyebrow}>Coordinator workspace / Report intake</p>
        <h1>Submitted reports</h1>
        <p>Review every submitted report and see whether it is unclaimed, claimed or already progressing through review.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.queueCardHeading}>
          <h2>{ownership === "unclaimed" ? "Unclaimed reports" : ownership === "mine" ? "My claimed reports" : ownership === "claimed" ? "Claimed reports" : "All submitted reports"}</h2>
          {state === "loaded" && <span className={styles.pendingChip}>{total} reports</span>}
        </div>

        {state === "loading" && (
          <div className={styles.queueMessage} role="status">
            <strong>Loading report queue…</strong>
            <p>Retrieving the latest available reports from ReefCare MY.</p>
          </div>
        )}

        {state === "error" && (
          <div className={styles.errorBox} role="alert">
            <strong>Report queue unavailable</strong>
            <p>{error}</p>
            <button className={styles.secondaryButton} type="button" onClick={retryLoad}>Try again</button>
          </div>
        )}

        {state === "loaded" && (
          <>
            <div className={styles.filters}>
              <label>
                Search reports
                <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Report reference or threat" />
              </label>
              <label>
                Site
                <select value={site} onChange={(event) => updateSite(event.target.value)}>
                  <option value="all">All sites</option>
                  {sites.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Ownership
                <select value={ownership} onChange={(event) => updateOwnership(event.target.value)}>
                  <option value="all">All reports</option>
                  <option value="unclaimed">Unclaimed</option>
                  <option value="claimed">Claimed</option>
                  <option value="mine">Claimed by me</option>
                </select>
              </label>
            </div>

            {reports.length > 0 && (
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>Report reference</th><th>Threat type</th><th>General site</th><th>Evidence</th><th>Priority</th><th>Status</th><th>Age</th><th>Owner</th><th>Action</th></tr></thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.reportReference}>
                        <td><strong>{report.reportReference}</strong></td>
                        <td>{report.threat}</td>
                        <td>{areaLabel(report.area)}</td>
                        <td><span className={styles.evidenceChip}>{humanise(report.evidenceCompleteness, "Not assessed")}</span><small className={styles.cellNote}>{report.evidenceCount ?? 0} file{report.evidenceCount === 1 ? "" : "s"}</small></td>
                        <td><div className={styles.priorityCell}><span className={styles.priorityChip} data-priority={priorityKey(report.priority)}>{humanise(report.priority, "Not set")}</span>{(report.priorityReasons ?? []).length > 0 && <span className={styles.priorityInfo}><button className={styles.priorityInfoButton} type="button" aria-label={`Priority information for ${report.reportReference}`} aria-describedby={`priority-info-${report.reportReference}`}>i</button><span className={styles.priorityTooltip} id={`priority-info-${report.reportReference}`} role="tooltip"><strong>Why this priority?</strong><ul>{report.priorityReasons?.map((reason) => <li key={reason}>{reason}</li>)}</ul></span></span>}</div></td>
                        <td><span className={styles.receivedChip}>{report.statusLabel}</span></td>
                        <td><time className={styles.ageValue} dateTime={report.submittedAt} title={`Submitted ${submittedDate(report.submittedAt)}`}>{waitingTime(report.hoursInQueue)}</time></td>
                        <td>{report.owner?.displayName ?? "Unclaimed"}</td>
                        <td>
                          {!report.owner && !report.claimedAt ? (
                            <Link className={styles.tableLink} href={`/coordinator/reports/${report.reportReference}?claim=1`}>
                              Review and claim<span className="sr-only"> {report.reportReference}</span>
                            </Link>
                          ) : report.owner?.id === currentUserId ? (
                            <Link className={styles.tableLink} href={`/coordinator/reports/${report.reportReference}`}>
                              View claimed case<span className="sr-only"> {report.reportReference}</span>
                            </Link>
                          ) : (
                            <span className={styles.muted}>Claimed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {reports.length === 0 && (
              <div className={styles.emptyState} role="status">
                <strong>{items.length === 0 ? "No reports were returned" : "No matching reports"}</strong>
                <p>{items.length === 0 ? "No submitted reports are currently available." : "Change the search, site or ownership filter to view other reports."}</p>
              </div>
            )}

            {total > 0 && (
              <nav className={styles.pagination} aria-label="Report queue pages">
                <p aria-live="polite">Showing {firstItem}–{lastItem} of {total} reports</p>
                <div>
                  <button className={styles.secondaryButton} type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button className={styles.secondaryButton} type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
                </div>
              </nav>
            )}
            <aside className={styles.priorityNotice}><strong>Priority is guidance, not a verdict</strong><p>These cues come from stated rules such as evidence availability and queue age. The Case Coordinator still reviews the evidence and makes every decision.</p></aside>
          </>
        )}
      </section>
    </section>
  );
}

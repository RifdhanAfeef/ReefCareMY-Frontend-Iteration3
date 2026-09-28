"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { closureReasons } from "@/features/epic-05-triage/triage-data";
import { getCoordinatorCaseHistory, getCoordinatorQueue } from "@/lib/api/coordinatorApi";
import type {
  CoordinatorHistoryFilters,
  CoordinatorHistoryItem,
  CoordinatorHistoryResult,
  CoordinatorQueueItem,
} from "@/lib/api/types";
import { readStoredAuth } from "@/lib/api/token-store";
import { userFacingError } from "@/lib/api/user-facing-error";
import { displayDateToIsoDate, formatDateTime, isValidDisplayDate } from "@/lib/format/date";
import { StatusPill } from "./status-pill";
import styles from "./access-ui.module.css";

type MyCaseRow = Pick<
  CoordinatorQueueItem,
  | "reportReference"
  | "threat"
  | "area"
  | "priority"
  | "priorityReasons"
  | "claimedAt"
  | "statusLabel"
>;

type WorkspaceView = "active" | "history";
type HistoryFilterDraft = {
  closureReason: string;
  threatCategory: string;
  closedFrom: string;
  closedTo: string;
  referral: "all" | "true" | "false";
};

const emptyHistoryFilters: HistoryFilterDraft = {
  closureReason: "",
  threatCategory: "",
  closedFrom: "",
  closedTo: "",
  referral: "all",
};

const threatCategories = [
  { code: "ghost_gear", label: "Ghost fishing gear" },
  { code: "coral_bleaching", label: "Coral bleaching" },
  { code: "marine_debris", label: "Marine debris" },
  { code: "physical_reef_damage", label: "Physical reef damage" },
  { code: "unsure", label: "Unsure" },
];

function displayDateTime(value?: string | null) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

function humanise(value?: string | null, fallback = "Not set") {
  if (!value) return fallback;
  return value.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function priorityKey(value?: string | null) {
  return (value ?? "not_set").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function startOfSelectedDate(displayDate: string) {
  const date = displayDateToIsoDate(displayDate);
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function afterSelectedDate(displayDate: string) {
  const date = displayDateToIsoDate(displayDate);
  if (!date) return undefined;
  const exclusiveEnd = new Date(`${date}T00:00:00.000Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  return exclusiveEnd.toISOString();
}

function referralSummary(record: CoordinatorHistoryItem) {
  if (!record.wasReferred) return "Not referred";
  if (record.referrals.length === 0) return "Referral recorded";
  const remaining = record.referrals.length - 1;
  return `${record.referrals[0].referredTo}${remaining > 0 ? ` +${remaining} more` : ""}`;
}

export function MyCasesWorkspace() {
  const currentUserId = readStoredAuth()?.user.id;
  const [view, setView] = useState<WorkspaceView>("active");
  const [cases, setCases] = useState<MyCaseRow[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState("");
  const [activeReloadKey, setActiveReloadKey] = useState(0);
  const [history, setHistory] = useState<CoordinatorHistoryResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDraft, setHistoryDraft] = useState<HistoryFilterDraft>(emptyHistoryFilters);
  const [historyFilters, setHistoryFilters] = useState<CoordinatorHistoryFilters>({});
  const [historyFilterError, setHistoryFilterError] = useState("");
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCases() {
      setActiveError("");
      try {
        const firstPage = await getCoordinatorQueue(1, 100);
        const pageSize = firstPage.pageSize || 100;
        const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
        const remainingPages = totalPages > 1
          ? await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, index) =>
                getCoordinatorQueue(index + 2, pageSize),
              ),
            )
          : [];
        if (!cancelled) {
          setCases(
            [firstPage, ...remainingPages]
              .flatMap((queuePage) => queuePage.items)
              .filter((record) => record.owner?.id === currentUserId),
          );
        }
      } catch (queueError) {
        if (cancelled) return;
        setCases([]);
        setActiveError(userFacingError(queueError, "Your claimed cases could not be loaded right now."));
      } finally {
        if (!cancelled) setActiveLoading(false);
      }
    }

    void loadCases();
    return () => { cancelled = true; };
  }, [currentUserId, activeReloadKey]);

  useEffect(() => {
    if (view !== "history") return;
    let cancelled = false;

    getCoordinatorCaseHistory({ ...historyFilters, page: historyPage, pageSize: 20 })
      .then((result) => {
        if (!cancelled) setHistory(result);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setHistory(null);
        setHistoryError(userFacingError(requestError, "Your closed-case history could not be loaded right now."));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [historyFilters, historyPage, historyReloadKey, view]);

  function retryActive() {
    setActiveLoading(true);
    setActiveError("");
    setActiveReloadKey((value) => value + 1);
  }

  function openHistory() {
    if (view === "history") return;
    setHistoryLoading(true);
    setHistoryError("");
    setView("history");
  }

  function applyHistoryFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHistoryFilterError("");
    if (historyDraft.closedFrom && !isValidDisplayDate(historyDraft.closedFrom)) {
      setHistoryFilterError("Enter a valid start date in dd/mm/yyyy format.");
      return;
    }
    if (historyDraft.closedTo && !isValidDisplayDate(historyDraft.closedTo)) {
      setHistoryFilterError("Enter a valid end date in dd/mm/yyyy format.");
      return;
    }
    const closedFrom = historyDraft.closedFrom ? startOfSelectedDate(historyDraft.closedFrom) : undefined;
    const closedTo = historyDraft.closedTo ? afterSelectedDate(historyDraft.closedTo) : undefined;
    if (closedFrom && closedTo && new Date(closedFrom) >= new Date(closedTo)) {
      setHistoryFilterError("The end date must be the same as or later than the start date.");
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");
    setHistoryPage(1);
    setHistoryFilters({
      closureReason: historyDraft.closureReason || undefined,
      threatCategory: historyDraft.threatCategory || undefined,
      closedFrom,
      closedTo,
      wasReferred: historyDraft.referral === "all" ? undefined : historyDraft.referral === "true",
    });
  }

  function clearHistoryFilters() {
    setHistoryDraft(emptyHistoryFilters);
    setHistoryFilterError("");
    setHistoryPage(1);
    setHistoryFilters({});
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryReloadKey((value) => value + 1);
  }

  function retryHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryReloadKey((value) => value + 1);
  }

  function changeHistoryPage(page: number) {
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryPage(page);
  }

  const historyPageCount = history
    ? Math.max(1, Math.ceil(history.total / Math.max(1, history.pageSize)))
    : 1;

  return <div className={styles.stack}>
    <nav className={styles.viewTabs} aria-label="My cases views">
      <button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Active cases <span>{cases.length}</span></button>
      <button type="button" aria-pressed={view === "history"} onClick={openHistory}>Closed history</button>
    </nav>

    {view === "active" && activeLoading && (
      <section className={styles.card}><div className={styles.emptyState} role="status"><h2 className={styles.sectionHeading}>Loading your claimed cases…</h2><p>Retrieving your current cases.</p></div></section>
    )}

    {view === "active" && !activeLoading && cases.length === 0 && (
      <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>{activeError ? "Your cases are unavailable" : "You have no claimed cases"}</h2><p>{activeError || "Reports you claim from the queue will appear here."}</p>{activeError && <button className={styles.secondaryButton} type="button" onClick={retryActive}>Try again</button>}<Link className={styles.primaryButton} href="/coordinator/report-queue">Open report queue</Link></div></section>
    )}

    {view === "active" && !activeLoading && cases.length > 0 && (
      <section className={styles.tableCard} aria-label="Cases owned by this coordinator"><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">Report</th><th scope="col">Threat</th><th scope="col">General area</th><th scope="col">Priority</th><th scope="col">Claimed</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{cases.map((record) => <tr key={record.reportReference}><td className={styles.identifier}>{record.reportReference}</td><td>{record.threat}</td><td>{record.area ?? "Not provided"}</td><td><div className={styles.priorityCell}><span className={styles.priorityChip} data-priority={priorityKey(record.priority)}>{humanise(record.priority)}</span>{(record.priorityReasons ?? []).length > 0 && <span className={styles.priorityInfo}><button className={styles.priorityInfoButton} type="button" aria-label={`Priority information for ${record.reportReference}`} aria-describedby={`priority-info-${record.reportReference}`}>i</button><span className={styles.priorityTooltip} id={`priority-info-${record.reportReference}`} role="tooltip"><strong>Why this priority?</strong><ul>{record.priorityReasons?.map((reason) => <li key={reason}>{reason}</li>)}</ul></span></span>}</div></td><td>{displayDateTime(record.claimedAt)}</td><td><StatusPill status={record.statusLabel} /></td><td><Link className={styles.textButton} href={`/coordinator/reports/${record.reportReference}`}>Open case<span className="sr-only"> {record.reportReference}</span></Link></td></tr>)}</tbody></table></div></section>
    )}

    {view === "history" && <>
      <section className={styles.card} aria-labelledby="history-filters-heading">
        <h2 className={styles.sectionHeading} id="history-filters-heading">Closed-case filters</h2>
        <p className={styles.sectionDescription}>Review cases you previously owned, including closure and referral history.</p>
        <form className={styles.historyFilters} onSubmit={applyHistoryFilters} noValidate>
          <label className={styles.field}><span className={styles.fieldLabel}>Closure reason</span><select className={styles.select} value={historyDraft.closureReason} onChange={(event) => setHistoryDraft((current) => ({ ...current, closureReason: event.target.value }))}><option value="">All closure reasons</option>{closureReasons.map((reason) => <option value={reason.value} key={reason.value}>{reason.label}</option>)}</select></label>
          <label className={styles.field}><span className={styles.fieldLabel}>Threat type</span><select className={styles.select} value={historyDraft.threatCategory} onChange={(event) => setHistoryDraft((current) => ({ ...current, threatCategory: event.target.value }))}><option value="">All threat types</option>{threatCategories.map((threat) => <option value={threat.code} key={threat.code}>{threat.label}</option>)}</select></label>
          <div className={styles.field}><span className={styles.fieldLabel}>Closed from</span><DisplayDateInput label="Closed from" value={historyDraft.closedFrom} onChange={(value) => setHistoryDraft((current) => ({ ...current, closedFrom: value }))} /></div>
          <div className={styles.field}><span className={styles.fieldLabel}>Closed to</span><DisplayDateInput label="Closed to" value={historyDraft.closedTo} onChange={(value) => setHistoryDraft((current) => ({ ...current, closedTo: value }))} /></div>
          <label className={styles.field}><span className={styles.fieldLabel}>Referral</span><select className={styles.select} value={historyDraft.referral} onChange={(event) => setHistoryDraft((current) => ({ ...current, referral: event.target.value as HistoryFilterDraft["referral"] }))}><option value="all">All cases</option><option value="true">Referred cases</option><option value="false">Not referred</option></select></label>
          <div className={styles.historyFilterActions}><button className={styles.primaryButton} type="submit">Apply filters</button><button className={styles.secondaryButton} type="button" onClick={clearHistoryFilters}>Clear</button></div>
        </form>
        {historyFilterError && <p className={styles.formError} role="alert">{historyFilterError}</p>}
      </section>

      {historyLoading && <section className={styles.card}><div className={styles.emptyState} role="status"><h2 className={styles.sectionHeading}>Loading closed cases…</h2></div></section>}
      {!historyLoading && historyError && <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>Closed history is unavailable</h2><p>{historyError}</p><button className={styles.secondaryButton} type="button" onClick={retryHistory}>Try again</button></div></section>}
      {!historyLoading && !historyError && history?.items.length === 0 && <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>No closed cases match these filters</h2><p>Change or clear the filters to see other cases.</p></div></section>}
      {!historyLoading && !historyError && history && history.items.length > 0 && <>
        <section className={styles.tableCard} aria-label="Closed cases owned by this coordinator"><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">Report</th><th scope="col">Threat</th><th scope="col">General area</th><th scope="col">Closed</th><th scope="col">Closure reason</th><th scope="col">Referral history</th><th scope="col">Action</th></tr></thead><tbody>{history.items.map((record) => <tr key={record.reportReference}><td className={styles.identifier}>{record.reportReference}</td><td>{record.threatCategory.label}</td><td>{record.generalLocation ?? "Not provided"}</td><td>{displayDateTime(record.closedAt)}</td><td><strong>{record.closureReason?.label ?? record.status.label}</strong>{record.closureNote && <small className={styles.tableNote}>{record.closureNote}</small>}</td><td>{record.wasReferred && record.referrals.length > 0 ? <details className={styles.referralDetails}><summary>{referralSummary(record)}</summary><ul>{record.referrals.map((referral) => <li key={`${referral.referredTo}-${referral.referredAt}`}><strong>{referral.referredTo}</strong><span>{displayDateTime(referral.referredAt)}</span>{referral.note && <span>{referral.note}</span>}</li>)}</ul></details> : referralSummary(record)}</td><td><Link className={styles.textButton} href={`/coordinator/reports/${record.reportReference}`}>Open history<span className="sr-only"> {record.reportReference}</span></Link></td></tr>)}</tbody></table></div></section>
        <nav className={styles.pagination} aria-label="Closed-case history pages"><button className={styles.secondaryButton} type="button" disabled={history.page <= 1} onClick={() => changeHistoryPage(Math.max(1, history.page - 1))}>Previous</button><span>Page {history.page} of {historyPageCount}</span><button className={styles.secondaryButton} type="button" disabled={history.page >= historyPageCount} onClick={() => changeHistoryPage(Math.min(historyPageCount, history.page + 1))}>Next</button></nav>
      </>}
    </>}
  </div>;
}

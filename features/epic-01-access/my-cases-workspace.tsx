"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { ResetSortingButton } from "@/components/tables/reset-sorting-button";
import { SortableColumnHeader } from "@/components/tables/sortable-column-header";
import { dateSortValue, nextTableSort, prioritySortValue, sortTableRows, type TableSort } from "@/components/tables/table-sort";
import { TableViewport } from "@/components/tables/table-viewport";
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

const displayPageSize = 10;

type ActiveSortKey = "reference" | "threat" | "area" | "priority" | "claimed" | "status";
type HistorySortKey = "reference" | "threat" | "area" | "closed" | "reason" | "referral";

function activeSortValue(record: MyCaseRow, key: ActiveSortKey) {
  switch (key) {
    case "reference": return record.reportReference;
    case "threat": return record.threat;
    case "area": return record.area;
    case "priority": return prioritySortValue(record.priority);
    case "claimed": return dateSortValue(record.claimedAt);
    case "status": return record.statusLabel;
  }
}

function historySortValue(record: CoordinatorHistoryItem, key: HistorySortKey) {
  switch (key) {
    case "reference": return record.reportReference;
    case "threat": return record.threatCategory.label;
    case "area": return record.generalLocation;
    case "closed": return dateSortValue(record.closedAt);
    case "reason": return record.closureReason?.label ?? record.status.label;
    case "referral": return referralSummary(record);
  }
}

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

function CasePagination({ label, page, pageCount, firstItem, lastItem, total, onPrevious, onNext }: {
  label: string; page: number; pageCount: number; firstItem: number; lastItem: number; total: number;
  onPrevious: () => void; onNext: () => void;
}) {
  return <nav className={styles.casePagination} aria-label={label}>
    <p aria-live="polite">Showing {firstItem}–{lastItem} of {total} cases</p>
    <div className={styles.casePaginationControls}>
      <button className={styles.secondaryButton} type="button" disabled={page <= 1} onClick={onPrevious}>Previous</button>
      <span>Page {page} of {pageCount}</span>
      <button className={styles.secondaryButton} type="button" disabled={page >= pageCount} onClick={onNext}>Next</button>
    </div>
  </nav>;
}

export function MyCasesWorkspace() {
  const currentUserId = readStoredAuth()?.user.id;
  const [view, setView] = useState<WorkspaceView>("active");
  const [cases, setCases] = useState<MyCaseRow[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allHistory, setAllHistory] = useState<CoordinatorHistoryResult | null>(null);
  const [activeSort, setActiveSort] = useState<TableSort<ActiveSortKey> | null>(null);
  const [historySort, setHistorySort] = useState<TableSort<HistorySortKey> | null>(null);
  const useLocalHistory = Boolean(searchQuery || historySort);
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
    if (view !== "history" || useLocalHistory) return;
    let cancelled = false;

    getCoordinatorCaseHistory({ ...historyFilters, page: historyPage, pageSize: displayPageSize })
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
  }, [historyFilters, historyPage, historyReloadKey, useLocalHistory, view]);

  useEffect(() => {
    if (view !== "history" || !useLocalHistory) return;
    let cancelled = false;
    async function loadClosedCases() {
      // Load all owner-scoped pages so both search and sorting cover the full result set.
      const first = await getCoordinatorCaseHistory({ ...historyFilters, page: 1, pageSize: 100 });
      if (cancelled) return;
      if (first.page !== 1 || first.pageSize < 1 || (first.total > 0 && first.items.length === 0)) throw new Error("Incomplete case history");
      const records = [...first.items];
      const pages = Math.max(1, Math.ceil(first.total / first.pageSize));
      for (let page = 2; page <= pages && !cancelled; page += 1) {
        const result = await getCoordinatorCaseHistory({ ...historyFilters, page, pageSize: first.pageSize });
        if (cancelled) return;
        if (result.page !== page || result.pageSize < 1 || result.items.length === 0) throw new Error("Incomplete case history");
        records.push(...result.items);
      }
      if (cancelled) return;
      const items = [...new Map(records.map((item) => [item.reportReference, item])).values()];
      setAllHistory({ ...first, items, page: 1, pageSize: displayPageSize, total: items.length });
    }
    loadClosedCases().catch((requestError) => {
      if (!cancelled) { setAllHistory(null); setHistoryError(userFacingError(requestError, "Your closed-case history could not be loaded right now.")); }
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [historyFilters, historyReloadKey, useLocalHistory, view]);

  function searchCases(value: string) {
    const query = value.trim().toLowerCase();
    setActivePage(1); setHistoryPage(1);
    if (query !== searchQuery) {
      if (view === "history" && (!useLocalHistory || !(query || historySort))) {
        setHistoryLoading(true); setHistoryError("");
      }
      setSearchQuery(query);
    } else if (!query && view === "history" && !useLocalHistory && historyPage !== 1) {
      setHistoryLoading(true); setHistoryError("");
    }
  }

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
    if (!useLocalHistory) setHistoryLoading(true);
    setHistoryError("");
    setHistoryPage(page);
  }

  function sortActiveBy(key: ActiveSortKey) {
    setActiveSort((current) => nextTableSort(current, key, key === "priority" || key === "claimed" ? "descending" : "ascending"));
    setActivePage(1);
  }

  function sortHistoryBy(key: HistorySortKey) {
    if (!useLocalHistory) { setHistoryLoading(true); setHistoryError(""); }
    setHistorySort((current) => nextTableSort(current, key, key === "closed" ? "descending" : "ascending"));
    setHistoryPage(1);
  }

  function resetSorting() {
    if (view === "active") { setActiveSort(null); setActivePage(1); }
    else {
      if (!searchQuery) { setHistoryLoading(true); setHistoryError(""); }
      setHistorySort(null); setHistoryPage(1);
    }
  }

  const matchingCases = sortTableRows(cases.filter((item) => !searchQuery || item.reportReference.toLowerCase().includes(searchQuery)), activeSort, activeSortValue);
  const activePageCount = Math.max(1, Math.ceil(matchingCases.length / displayPageSize));
  const currentActivePage = Math.min(activePage, activePageCount);
  const firstActiveItem = (currentActivePage - 1) * displayPageSize + 1;
  const lastActiveItem = Math.min(currentActivePage * displayPageSize, matchingCases.length);
  const visibleCases = matchingCases.slice(firstActiveItem - 1, lastActiveItem);
  const matchingHistory = sortTableRows((allHistory?.items ?? []).filter((item) => !searchQuery || item.reportReference.toLowerCase().includes(searchQuery)), historySort, historySortValue);
  const displayedHistory = useLocalHistory ? allHistory && { ...allHistory, page: historyPage, total: matchingHistory.length,
    items: matchingHistory.slice((historyPage - 1) * displayPageSize, historyPage * displayPageSize) } : history;
  const historyPageCount = displayedHistory
    ? Math.max(1, Math.ceil(displayedHistory.total / Math.max(1, displayedHistory.pageSize))) : 1;

  return <div className={styles.stack}>
    <nav className={styles.viewTabs} aria-label="My cases views">
      <button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Active cases <span>{cases.length}</span></button>
      <button type="button" aria-pressed={view === "history"} onClick={openHistory}>Closed history</button>
    </nav>

    <form className={styles.caseSearchForm} role="search" aria-label="Search my cases" onSubmit={(event) => { event.preventDefault(); searchCases(searchDraft); }}>
      <label className={styles.field} htmlFor="my-case-search"><span className={styles.fieldLabel}>Case number</span>
        <input className={styles.input} id="my-case-search" type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="e.g. RC-0033" />
      </label>
      <button className={styles.primaryButton} type="submit">Search</button>
      {(searchQuery || searchDraft) && <button className={styles.secondaryButton} type="button" onClick={() => { setSearchDraft(""); searchCases(""); }}>Clear</button>}
      <p>Search within this tab.</p>
    </form>

    {(view === "active" ? activeSort : historySort) && <ResetSortingButton onReset={resetSorting} />}

    {view === "active" && activeLoading && (
      <section className={styles.card}><div className={styles.emptyState} role="status"><h2 className={styles.sectionHeading}>Loading your claimed cases…</h2><p>Retrieving your current cases.</p></div></section>
    )}

    {view === "active" && !activeLoading && cases.length === 0 && (
      <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>{activeError ? "Your cases are unavailable" : "You have no claimed cases"}</h2><p>{activeError || "Reports you claim from the queue will appear here."}</p>{activeError && <button className={styles.secondaryButton} type="button" onClick={retryActive}>Try again</button>}<Link className={styles.primaryButton} href="/coordinator/report-queue">Open report queue</Link></div></section>
    )}

    {view === "active" && !activeLoading && cases.length > 0 && matchingCases.length === 0 && <section className={styles.card}>
      <div className={styles.emptyState} role="status"><h2 className={styles.sectionHeading}>No matching cases</h2><p>Check the case number or clear your search.</p></div>
    </section>}
    {view === "active" && !activeLoading && matchingCases.length > 0 && (
      <section className={`${styles.tableCard} ${styles.caseListCard}`} aria-label="Cases owned by this coordinator"><TableViewport className={styles.caseTableViewport} label="My active cases table"><table className={`${styles.table} ${styles.responsiveCasesTable} ${styles.activeCasesTable}`}><thead><tr><SortableColumnHeader label="Report" direction={activeSort?.key === "reference" ? activeSort.direction : undefined} onSort={() => sortActiveBy("reference")} /><SortableColumnHeader label="Threat" direction={activeSort?.key === "threat" ? activeSort.direction : undefined} onSort={() => sortActiveBy("threat")} /><SortableColumnHeader label="General area" direction={activeSort?.key === "area" ? activeSort.direction : undefined} onSort={() => sortActiveBy("area")} /><SortableColumnHeader label="Priority" direction={activeSort?.key === "priority" ? activeSort.direction : undefined} onSort={() => sortActiveBy("priority")} nextDirection="descending" /><SortableColumnHeader label="Claimed" direction={activeSort?.key === "claimed" ? activeSort.direction : undefined} onSort={() => sortActiveBy("claimed")} nextDirection="descending" /><SortableColumnHeader label="Status" direction={activeSort?.key === "status" ? activeSort.direction : undefined} onSort={() => sortActiveBy("status")} /><th scope="col">Action</th></tr></thead><tbody>{visibleCases.map((record) => <tr key={record.reportReference}><td data-label="Report" className={styles.identifier}>{record.reportReference}</td><td data-label="Threat">{record.threat}</td><td data-label="General area">{record.area ?? "Not provided"}</td><td data-label="Priority"><div className={styles.priorityCell}><span className={styles.priorityChip} data-priority={priorityKey(record.priority)}>{humanise(record.priority)}</span>{(record.priorityReasons ?? []).length > 0 && <span className={styles.priorityInfo}><button className={styles.priorityInfoButton} type="button" aria-label={`Priority information for ${record.reportReference}`} title={(record.priorityReasons ?? []).join(" • ")} aria-describedby={`priority-info-${record.reportReference}`}>i</button><span className={styles.priorityTooltip} id={`priority-info-${record.reportReference}`} role="tooltip"><strong>Why this priority?</strong><ul>{record.priorityReasons?.map((reason) => <li key={reason}>{reason}</li>)}</ul></span></span>}</div></td><td data-label="Claimed">{displayDateTime(record.claimedAt)}</td><td data-label="Status"><StatusPill status={record.statusLabel} /></td><td data-label="Action"><Link className={styles.textButton} href={`/coordinator/reports/${record.reportReference}`}>Open case<span className="sr-only"> {record.reportReference}</span></Link></td></tr>)}</tbody></table></TableViewport>
        <CasePagination label="Active-case pages" page={currentActivePage} pageCount={activePageCount}
          firstItem={firstActiveItem} lastItem={lastActiveItem} total={matchingCases.length}
          onPrevious={() => setActivePage(currentActivePage - 1)} onNext={() => setActivePage(currentActivePage + 1)} />
      </section>
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
          <div className={styles.historyFilterActions}><button className={styles.primaryButton} type="submit">Apply filters</button><button className={styles.secondaryButton} type="button" onClick={clearHistoryFilters}>Clear filters</button></div>
        </form>
        {historyFilterError && <p className={styles.formError} role="alert">{historyFilterError}</p>}
      </section>

      {historyLoading && <section className={styles.card}><div className={styles.emptyState} role="status"><h2 className={styles.sectionHeading}>Loading closed cases…</h2></div></section>}
      {!historyLoading && historyError && <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>Closed history is unavailable</h2><p>{historyError}</p><button className={styles.secondaryButton} type="button" onClick={retryHistory}>Try again</button></div></section>}
      {!historyLoading && !historyError && displayedHistory?.items.length === 0 && <section className={styles.card}><div className={styles.emptyState}><h2 className={styles.sectionHeading}>{searchQuery ? "No matching closed cases" : "No closed cases match these filters"}</h2><p>{searchQuery ? "Check the case number, search filters or clear your search." : "Change or clear the filters to see other cases."}</p></div></section>}
      {!historyLoading && !historyError && displayedHistory && displayedHistory.items.length > 0 && <>
        <section className={`${styles.tableCard} ${styles.caseListCard}`} aria-label="Closed cases owned by this coordinator"><TableViewport className={styles.caseTableViewport} label="Closed cases table"><table className={`${styles.table} ${styles.responsiveCasesTable}`}><thead><tr><SortableColumnHeader label="Report" direction={historySort?.key === "reference" ? historySort.direction : undefined} onSort={() => sortHistoryBy("reference")} /><SortableColumnHeader label="Threat" direction={historySort?.key === "threat" ? historySort.direction : undefined} onSort={() => sortHistoryBy("threat")} /><SortableColumnHeader label="General area" direction={historySort?.key === "area" ? historySort.direction : undefined} onSort={() => sortHistoryBy("area")} /><SortableColumnHeader label="Closed" direction={historySort?.key === "closed" ? historySort.direction : undefined} onSort={() => sortHistoryBy("closed")} nextDirection="descending" /><SortableColumnHeader label="Closure reason" direction={historySort?.key === "reason" ? historySort.direction : undefined} onSort={() => sortHistoryBy("reason")} /><SortableColumnHeader label="Referral history" direction={historySort?.key === "referral" ? historySort.direction : undefined} onSort={() => sortHistoryBy("referral")} /><th scope="col">Action</th></tr></thead><tbody>{displayedHistory.items.map((record) => <tr key={record.reportReference}><td data-label="Report" className={styles.identifier}>{record.reportReference}</td><td data-label="Threat">{record.threatCategory.label}</td><td data-label="General area">{record.generalLocation ?? "Not provided"}</td><td data-label="Closed">{displayDateTime(record.closedAt)}</td><td data-label="Closure reason"><strong>{record.closureReason?.label ?? record.status.label}</strong>{record.closureNote && <small className={styles.tableNote}>{record.closureNote}</small>}</td><td data-label="Referral history">{record.wasReferred && record.referrals.length > 0 ? <details className={styles.referralDetails}><summary>{referralSummary(record)}</summary><ul>{record.referrals.map((referral) => <li key={`${referral.referredTo}-${referral.referredAt}`}><strong>{referral.referredTo}</strong><span>{displayDateTime(referral.referredAt)}</span>{referral.note && <span>{referral.note}</span>}</li>)}</ul></details> : referralSummary(record)}</td><td data-label="Action"><Link className={styles.textButton} href={`/coordinator/reports/${record.reportReference}`}>Open history<span className="sr-only"> {record.reportReference}</span></Link></td></tr>)}</tbody></table></TableViewport>
          <CasePagination label="Closed-case history pages" page={displayedHistory.page} pageCount={historyPageCount}
            firstItem={(displayedHistory.page - 1) * displayedHistory.pageSize + 1}
            lastItem={Math.min(displayedHistory.page * displayedHistory.pageSize, displayedHistory.total)} total={displayedHistory.total}
            onPrevious={() => changeHistoryPage(Math.max(1, displayedHistory.page - 1))}
            onNext={() => changeHistoryPage(Math.min(historyPageCount, displayedHistory.page + 1))} />
        </section>
      </>}
    </>}
  </div>;
}

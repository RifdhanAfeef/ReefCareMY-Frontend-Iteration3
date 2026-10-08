"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { getDiveSites } from "@/lib/api/referenceApi";
import { getSiteHistory } from "@/lib/api/iteration3Api";
import type { SiteHistory, SiteHistoryItem } from "@/lib/api/iteration3-types";
import type { DiveSiteReference } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { displayDateToIsoDate, isValidDisplayDate } from "@/lib/format/date";
import styles from "./site-history.module.css";

function eventTitle(item: SiteHistoryItem) {
  if (item.recordType === "observation") return item.threatCategoryLabel || "Reef observation";
  if (item.recordType === "monitoring") return "Monitoring visit";
  if (item.recordType === "sourced_outcome") return "Sourced outcome";
  return item.followUpState === "action_planned" ? "Action planned" : "Action taken";
}

function eventDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function SiteHistoryPage() {
  const [sites, setSites] = useState<DiveSiteReference[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [area, setArea] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recordType, setRecordType] = useState<"all" | SiteHistoryItem["recordType"]>("all");
  const [history, setHistory] = useState<SiteHistory | null>(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const areas = useMemo(() => [...new Set(sites.map((site) => site.publicAreaLabel))].sort(), [sites]);
  const filteredSites = useMemo(() => sites.filter((site) =>
    (!area || site.publicAreaLabel === area)
    && `${site.name} ${site.publicAreaLabel}`.toLowerCase().includes(siteSearch.trim().toLowerCase()),
  ).sort((left, right) => left.name.localeCompare(right.name)), [sites, area, siteSearch]);
  const invalidFrom = Boolean(dateFrom && !isValidDisplayDate(dateFrom));
  const invalidTo = Boolean(dateTo && !isValidDisplayDate(dateTo));
  const invalidDateInput = invalidFrom || invalidTo;
  const fromIso = dateFrom && !invalidFrom ? displayDateToIsoDate(dateFrom) : "";
  const toIso = dateTo && !invalidTo ? displayDateToIsoDate(dateTo) : "";
  const invalidDateRange = Boolean(fromIso && toIso && fromIso > toIso);
  const filteredHistoryItems = useMemo(() => (history?.items ?? []).filter((item) => {
    const date = item.occurredOn.slice(0, 10);
    return !invalidDateInput && !invalidDateRange && (recordType === "all" || item.recordType === recordType)
      && (!fromIso || date >= fromIso) && (!toIso || date <= toIso);
  }), [history, recordType, fromIso, toIso, invalidDateInput, invalidDateRange]);

  useEffect(() => {
    let cancelled = false;
    getDiveSites().then((items) => {
      if (!cancelled) { setSites(items); setLoadingHistory(items.length > 0); setSiteId((current) => current ?? items[0]?.diveSiteId ?? null); }
    }).catch((requestError) => {
      if (!cancelled) setError(userFacingError(requestError, "Dive sites could not be loaded."));
    }).finally(() => { if (!cancelled) setLoadingSites(false); });
    return () => { cancelled = true; };
  }, [retryKey]);
  useEffect(() => {
    if (siteId == null) return;
    let cancelled = false;
    getSiteHistory(siteId).then((result) => { if (!cancelled) setHistory(result); })
      .catch((requestError) => { if (!cancelled) setError(userFacingError(requestError, "Site history could not be loaded.")); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [siteId, retryKey]);

  function selectSite(value: number) {
    setHistory(null); setError(""); setLoadingHistory(true); setSiteId(value);
  }
  function filterArea(value: string) {
    setArea(value); setSiteSearch("");
    const first = sites.find((site) => !value || site.publicAreaLabel === value);
    if (first && first.diveSiteId !== siteId) selectSite(first.diveSiteId);
    if (!first) { setSiteId(null); setHistory(null); setLoadingHistory(false); }
  }
  function searchSites(value: string) {
    setSiteSearch(value);
    if (siteId !== null && !sites.some((site) => site.diveSiteId === siteId
      && (!area || site.publicAreaLabel === area)
      && `${site.name} ${site.publicAreaLabel}`.toLowerCase().includes(value.trim().toLowerCase()))) {
      setSiteId(null); setHistory(null); setLoadingHistory(false);
    }
  }
  function retry() {
    setHistory(null); setError("");
    if (siteId === null) setLoadingSites(true);
    else setLoadingHistory(true);
    setRetryKey((value) => value + 1);
  }

  return <main className={styles.page}>
    <header className={styles.hero}><p className={styles.eyebrow}>Conservation context</p>
      <h1>Site conservation history</h1>
      <p>Review recorded observations, actions and monitoring for one configured dive site. For patterns across areas, use <Link href="/coordinator/hotspots">Hotspot analysis</Link>.</p>
    </header>
    <section className={styles.card}>
      <div className={styles.siteFilters} aria-label="Find a dive site">
        <label className={styles.selectLabel}>Island or area
          <select value={area} onChange={(event) => filterArea(event.target.value)} disabled={loadingSites || sites.length === 0}>
            <option value="">All areas</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.selectLabel}>Search dive sites
          <input type="search" value={siteSearch} onChange={(event) => searchSites(event.target.value)} placeholder="Search by name" disabled={loadingSites || sites.length === 0} />
        </label>
        <label className={styles.selectLabel}>Dive site
          <select value={filteredSites.some((site) => site.diveSiteId === siteId) ? siteId ?? "" : ""} onChange={(event) => event.target.value && selectSite(Number(event.target.value))} disabled={loadingSites || filteredSites.length === 0}>
            <option value="">Choose a dive site</option>{filteredSites.map((site) => <option key={site.diveSiteId} value={site.diveSiteId}>{site.name} · {site.publicAreaLabel}</option>)}
          </select>
        </label>
      </div>
      {!loadingSites && <p className={styles.filterNote}>{filteredSites.length} matching dive site{filteredSites.length === 1 ? "" : "s"}{filteredSites.length === 0 ? ". Try another search or area." : "."}</p>}
      {loadingSites && <p role="status">Loading dive sites…</p>}
      {loadingHistory && <p role="status">Loading recorded site history…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={retry}>Try again</button></div>}
      {!loadingSites && siteId === null && filteredSites.length > 0 && <p role="status">Choose a dive site to view its history.</p>}
      {history && filteredSites.some((site) => site.diveSiteId === siteId) && <>
        <h2>{history.siteName}</h2><p>{history.publicAreaLabel}</p>
        <p role="status">{history.message}</p>
        <div className={styles.counts} aria-label="All recorded site history totals">
          <div><strong>{history.counts.observations}</strong><span>Observations</span></div>
          <div><strong>{history.counts.actions}</strong><span>Actions</span></div>
          <div><strong>{history.counts.monitoringVisits}</strong><span>Monitoring visits</span></div>
          <div><strong>{history.counts.sourcedOutcomes}</strong><span>Sourced outcomes</span></div>
        </div>
        {history.items.length > 0 && <>
          <p className={styles.period}>All records: {eventDate(history.firstRecordOn)} – {eventDate(history.lastRecordOn)}</p>
          <div className={styles.historyFilters} aria-label="Filter site history">
            <div className={styles.selectLabel}><span>From date</span>
              <DisplayDateInput label="From date" value={dateFrom} onChange={setDateFrom} invalid={invalidFrom} />
            </div>
            <div className={styles.selectLabel}><span>To date</span>
              <DisplayDateInput label="To date" value={dateTo} onChange={setDateTo} invalid={invalidTo} />
            </div>
            <label className={styles.selectLabel}>Record type
              <select value={recordType} onChange={(event) => setRecordType(event.target.value as typeof recordType)}>
                <option value="all">All records</option><option value="observation">Observations</option>
                <option value="action">Actions</option><option value="monitoring">Monitoring visits</option>
                <option value="sourced_outcome">Sourced outcomes</option>
              </select>
            </label>
            <button type="button" className={styles.clearButton} onClick={() => { setDateFrom(""); setDateTo(""); setRecordType("all"); }} disabled={!dateFrom && !dateTo && recordType === "all"}>Clear filters</button>
          </div>
          {invalidDateInput ? <p role="alert" className={styles.filterError}>Enter complete dates in dd/mm/yyyy format.</p>
            : invalidDateRange ? <p role="alert" className={styles.filterError}>From date must be on or before To date.</p>
            : <p className={styles.filterNote} role="status">Showing {filteredHistoryItems.length} of {history.items.length} recorded entries. Counts above cover all site records.</p>}
          {!invalidDateInput && !invalidDateRange && filteredHistoryItems.length === 0 && <p className={styles.noResults}>No records match these filters. Try a wider date range or another record type.</p>}
          {!invalidDateInput && !invalidDateRange && filteredHistoryItems.length > 0 && <ol className={styles.timeline}>{filteredHistoryItems.map((item, index) => <li key={`${item.recordType}-${item.recordedAt}-${index}`} data-record-type={item.recordType}>
            <div className={styles.eventHead}><span className={styles.tag}>{item.recordType.replaceAll("_", " ")}</span>
              <time dateTime={item.occurredOn}>{eventDate(item.occurredOn)}</time></div>
            <h3>{eventTitle(item)}</h3>
            {item.recordType === "observation" && <p className={styles.assessment} data-assessment={item.assessmentState}>Assessment: {item.assessmentStateLabel || "Not yet assessed"}</p>}
            {item.recordType === "monitoring" && <p>Human-reviewed condition: {item.conditionLabel || "Not recorded"}</p>}
            {item.recordedOutcome && <p>{item.recordedOutcome}</p>}
            {item.followUpState === "action_planned" && <p>Planned work has not been recorded as completed.</p>}
            {item.nextFollowUpRequired === true && <p>Further follow-up required{item.nextFollowUpDate ? ` by ${eventDate(item.nextFollowUpDate)}` : ""}.</p>}
            {item.nextFollowUpRequired === false && <p>No follow-up currently scheduled.</p>}
            {item.ownedByYou && item.reportReference && <Link href={`/coordinator/reports/${encodeURIComponent(item.reportReference)}`}>Open your case {item.reportReference}</Link>}
          </li>)}</ol>}
        </>}
        {history.hotspotNote && <p className={styles.hotspotNote}>{history.hotspotNote} <Link href="/coordinator/hotspots">View hotspot analysis</Link></p>}
      </>}
    </section>
  </main>;
}

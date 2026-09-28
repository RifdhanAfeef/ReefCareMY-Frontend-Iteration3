"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { getHotspotAnalysis, getHotspotOptions, hotspotQuery } from "@/lib/api/hotspotsApi";
import type { HotspotFilters, HotspotOptions } from "@/lib/api/hotspot-types";
import { malaysiaTime, parseHotspotFilters, periodLabel } from "./filters";
import { HotspotFilterForm } from "./hotspot-filters";
import { HotspotMapPanel } from "./map-panel";
import { ReportingFrequency, ThreatBreakdown } from "./hotspot-charts";
import { HotspotReportList } from "./hotspot-reports";
import { HotspotError, HotspotLoading } from "./hotspot-status";
import { useHotspotResource } from "./use-hotspot-resource";
import styles from "./hotspots.module.css";

export function HotspotAnalysisPage() {
  const [revision, setRevision] = useState(0);
  const options = useHotspotResource(`options:${revision}`, getHotspotOptions);
  return <div className={styles.page}>
    <header className={styles.pageHeading}><div><p className={styles.eyebrow}>Coordinator workspace / Geographic analysis</p><h1>Geospatial hotspot analysis</h1><p>Explore where reef observations are reported, and how reporting changes over time.</p></div><Link className={styles.secondaryButton} href="/coordinator/report-queue">Report intake ↗</Link></header>
    <aside className={styles.interpretation}><span aria-hidden="true">ⓘ</span><p><strong>Reporting activity, with context.</strong> Counts represent individual reports, not confirmed incidents. More reporting does not establish ecological risk; fewer reports do not establish safety.</p></aside>
    {options.loading ? <HotspotLoading message="Loading sites and observation filters…" /> : !options.data || options.data.state !== "ready" ? <HotspotError error={options.error} title="Analysis options unavailable" onRetry={() => setRevision((value) => value + 1)} /> : <HotspotWorkspace options={options.data} />}
  </div>;
}

function HotspotWorkspace({ options }: { options: HotspotOptions }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams.toString();
  const parsed = useMemo(() => parseHotspotFilters(search, options.defaultFilters), [search, options.defaultFilters]);
  const [revision, setRevision] = useState(0);
  const apply = useCallback((filters: HotspotFilters) => {
    const query = hotspotQuery(filters);
    if (query === search) setRevision((value) => value + 1);
    else router.push(`/coordinator/hotspots?${query}`, { scroll: false });
  }, [router, search]);
  const reset = () => apply(options.defaultFilters);

  return <>
    {parsed.error && <div className={styles.error} role="alert"><strong>Check this analysis link</strong><p>{parsed.error}</p><button className={styles.secondaryButton} type="button" onClick={reset}>Reset filters</button></div>}
    <HotspotFilterForm key={search} filters={parsed.filters} options={options} onApply={apply} onReset={reset} />
    {!parsed.error && <HotspotResults key={`${hotspotQuery(parsed.filters)}:${revision}`} filters={parsed.filters} options={options} onSelectSite={(siteId) => apply({ ...parsed.filters, siteId })} />}
  </>;
}

function HotspotResults({ filters, options, onSelectSite }: { filters: HotspotFilters; options: HotspotOptions; onSelectSite: (id: number) => void }) {
  const [revision, setRevision] = useState(0);
  const [showReports, setShowReports] = useState(false);
  const load = useCallback((signal: AbortSignal) => getHotspotAnalysis(filters, signal), [filters]);
  const result = useHotspotResource(`analysis:${hotspotQuery(filters)}:${revision}`, load);
  const analysis = result.data;
  if (result.loading) return <HotspotLoading />;
  if (!analysis || analysis.state === "unavailable" || !analysis.summary || !analysis.dataQuality) return <HotspotError error={result.error} onRetry={() => setRevision((value) => value + 1)} />;
  const { summary, dataQuality: quality } = analysis;
  const currentSite = options.sites.find((site) => site.siteId === analysis.filters.siteId);
  const selectedThreat = options.threats.find((threat) => threat.code === analysis.filters.threat);
  const chips = [analysis.filters.region, analysis.filters.area, currentSite?.name ?? (analysis.filters.siteId ? `Site ${analysis.filters.siteId}` : "All dive sites"), selectedThreat?.label ?? "All threats, including Unsure"];

  return <div className={styles.results}>
    <div className={styles.resultsHeading}><div><p className={styles.eyebrow}>Active selection</p><h2>{periodLabel(analysis.filters)}</h2><div className={styles.chips}>{chips.filter(Boolean).map((chip, index) => <span key={`${chip}-${index}`}>{chip}</span>)}<span>{analysis.filters.interval === "day" ? "Daily" : analysis.filters.interval === "week" ? "Weekly" : "Monthly"} intervals</span></div></div><div className={styles.updated}><span>Updated {malaysiaTime(analysis.lastSuccessfulUpdateAt)} MYT</span><button className={styles.textButton} type="button" onClick={() => setRevision((value) => value + 1)}>Refresh analysis ↻</button></div></div>
    <div className={styles.statGrid}>
      <div><span>Reports at named sites</span><strong>{summary.reportCount.toLocaleString()}</strong><small>Within the selected observation period</small></div>
      <div><span>Sites with reports</span><strong>{analysis.sites.length.toLocaleString()}</strong><small>Named-site associations</small></div>
      <div><span>Reports on the map</span><strong>{quality.mappedReportCount.toLocaleString()} <em>/ {summary.reportCount.toLocaleString()}</em></strong><small>{quality.unmappedReportCount.toLocaleString()} without approved map locations</small></div>
    </div>
    {analysis.state !== "ready" && <div className={styles.notice} role="status"><strong>{analysis.state === "no_matches" ? "No matching reports" : "Not enough usable geographic data"}</strong><p>{analysis.message}</p></div>}
    <div className={styles.analysisGrid}><HotspotMapPanel analysis={analysis} onSelect={onSelectSite} /><ThreatBreakdown summary={summary} /></div>
    <div className={styles.analysisGrid}>
      <section className={styles.card} id="reporting-sites" aria-labelledby="sites-heading"><div className={styles.sectionHeading}><div><h2 id="sites-heading">Reports by dive site</h2><p>Every usable named site is included, even without map coordinates.</p></div><span className={styles.badge}>{analysis.sites.length} sites</span></div>
        {analysis.sites.length ? <ul className={styles.siteList}>{analysis.sites.map((item) => <li key={item.site.siteId}><button type="button" onClick={() => onSelectSite(item.site.siteId)} aria-label={`Explore ${item.site.name}, ${item.reportCount} reports`}>
          <span className={styles.siteTitle}><strong>{item.site.name}</strong><small>{[item.site.area, item.site.region].filter(Boolean).join(" · ")}{!item.mapLocation && " · Summary only"}</small></span><span className={styles.siteCount}>{item.reportCount.toLocaleString()} <small>reports →</small></span><span className={styles.siteBar} aria-hidden="true" style={{ width: `${100 * item.reportCount / Math.max(1, ...analysis.sites.map((site) => site.reportCount))}%` }} />
        </button></li>)}</ul> : <p className={styles.muted}>There are no usable named-site counts for this selection.</p>}
      </section>
      <ReportingFrequency summary={summary} filters={analysis.filters} />
    </div>
    <section className={styles.coverage} aria-labelledby="coverage-heading"><div><h2 id="coverage-heading">Understand the data</h2><p>{analysis.metadata.interpretation}</p></div><dl><div><dt>Reports matching dates and filters</dt><dd>{quality.matchingReportCount}</dd></div><div><dt>Excluded: no usable named site</dt><dd>{quality.excludedMissingSiteCount}</dd></div><div><dt>Undated reports outside period assignment</dt><dd>{quality.undatedReportCount}</dd></div></dl><details className={styles.details}><summary>Location, time and counting basis</summary><p>{analysis.metadata.countBasis}</p><p>{analysis.metadata.locationBasis}</p><p>{analysis.metadata.selectionBasis}</p><p>{analysis.metadata.timeBasis}</p><p>Undated reports match the non-date filters only. They cannot be assigned to the selected observation period.</p></details></section>
    {summary.reportCount > 0 && <div className={styles.reportSection}>
      <button className={styles.primaryButton} type="button" aria-expanded={showReports} aria-controls="contributing-reports" onClick={() => setShowReports((value) => !value)}>{showReports ? "Hide contributing reports" : `Inspect contributing reports (${summary.reportCount})`}</button>
      {showReports && <HotspotReportList key={`${hotspotQuery(analysis.filters)}:${revision}`} filters={analysis.filters} expectedTotal={summary.reportCount} />}
    </div>}
  </div>;
}

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { getHotspotReports, hotspotQuery } from "@/lib/api/hotspotsApi";
import type { HotspotFilters } from "@/lib/api/hotspot-types";
import { malaysiaTime } from "./filters";
import { HotspotError, HotspotLoading } from "./hotspot-status";
import { useHotspotResource } from "./use-hotspot-resource";
import styles from "./hotspots.module.css";

const ownershipLabels = { mine: "Your case", other: "Assigned", unclaimed: "Unclaimed" };

export function HotspotReportList({ filters, expectedTotal }: { filters: HotspotFilters; expectedTotal: number }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const query = hotspotQuery(filters);
  const load = useCallback((signal: AbortSignal) => getHotspotReports(filters, page, signal), [filters, page]);
  const result = useHotspotResource(`reports:${query}:${page}:${revision}`, load);
  const data = result.data;
  const totalPages = data?.total !== null && data?.total !== undefined ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <section className={styles.card} id="contributing-reports" aria-labelledby="reports-heading">
    <div className={styles.sectionHeading}><div><h2 id="reports-heading">Contributing reports</h2><p>Permitted intake information. Claim a report before opening protected evidence.</p></div></div>
    {result.loading ? <HotspotLoading message="Loading contributing reports…" /> : !data || data.state === "unavailable" ? <HotspotError error={result.error} onRetry={() => setRevision((n) => n + 1)} title="Report list unavailable" /> : <>
      {data.total !== expectedTotal && <p className={styles.notice} role="status">Reporting activity has changed since the summary loaded. Refresh the analysis to reconcile the counts.</p>}
      {data.items.length ? <div className={styles.tableScroll}><table><caption className="sr-only">Reports contributing to the active hotspot filters</caption><thead><tr><th>Report</th><th>Site / threat</th><th>Observed · MYT</th><th>Status</th><th>Ownership</th><th><span className="sr-only">Inspect</span></th></tr></thead><tbody>{data.items.map((item) => <tr key={item.reportReference}>
        <td><strong>{item.reportReference}</strong></td><td>{item.site?.name ?? "Not available"}<small>{item.threat}</small></td><td>{malaysiaTime(item.observedAt)}</td><td>{item.statusLabel}</td><td><span className={styles.badge}>{ownershipLabels[item.ownership]}</span>{item.ownerDisplayName && <small>{item.ownerDisplayName}</small>}</td><td><Link className={styles.textLink} href={`/coordinator/hotspots/reports/${encodeURIComponent(item.reportReference)}?${query}`} aria-label={`Inspect report ${item.reportReference}`}>Inspect →</Link></td>
      </tr>)}</tbody></table></div> : <p className={styles.notice} role="status">{data.total ? "This page has no reports. Return to the first page." : "No reports match this selection."}</p>}
      <div className={styles.pagination}><span>{data.total?.toLocaleString() ?? "—"} reports · Page {page} of {totalPages}</span><div className={styles.actions}>
        {page > totalPages && <button type="button" className={styles.secondaryButton} onClick={() => setPage(1)}>First page</button>}
        <button type="button" className={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={styles.secondaryButton} disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div></div>
    </>}
  </section>;
}

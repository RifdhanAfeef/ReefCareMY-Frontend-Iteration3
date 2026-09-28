"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { getHotspotContext, hotspotQuery } from "@/lib/api/hotspotsApi";
import { malaysiaTime, periodLabel, validateHotspotFilters } from "./filters";
import { HotspotLoading } from "./hotspot-status";
import { useHotspotResource } from "./use-hotspot-resource";
import styles from "./hotspots.module.css";

/** Fetch independently, only after the existing owned-case request succeeded. */
export function HotspotCaseContext({ reportReference }: { reportReference: string }) {
  const [revision, setRevision] = useState(0);
  const load = useCallback((signal: AbortSignal) => getHotspotContext(reportReference, signal), [reportReference]);
  const result = useHotspotResource(`context:${reportReference}:${revision}`, load);
  const context = result.data;
  const filters = context?.filters ?? null;
  const representedArea = context?.site?.name ?? filters?.area ?? filters?.region ?? "Generalised area unavailable";
  const hasValidSelection = Boolean(filters && context?.analysisQuery && !validateHotspotFilters(filters));
  const stateHeading = context?.state === "insufficient_data"
    ? "Limited area context"
    : context?.state === "no_matches"
      ? "No matching reports in this selection"
      : null;

  return <section className={styles.context} aria-labelledby="area-context-heading">
    <div className={styles.contextHeader}>
      <div><p className={styles.eyebrow}>Compact area context</p><h2 id="area-context-heading">Reporting around this observation</h2></div>
      <p>Generalised reporting activity supports triage; it does not verify this report.</p>
    </div>
    {result.loading ? <div className={styles.contextState}><HotspotLoading message="Checking area reporting context…" /><p>Case evidence and review controls remain available while this loads.</p></div> : !context || context.state === "unavailable" ? <div className={styles.contextState} role="status"><strong>Area context unavailable</strong><p>Continue reviewing the evidence and case details. Area analysis is not required to make progress.</p><button className={styles.textButton} type="button" onClick={() => setRevision((value) => value + 1)}>Retry area context</button></div> : <>
      {stateHeading && <div className={styles.contextState} role="status"><strong>{stateHeading}</strong><p>{context.message}</p></div>}
      <dl className={styles.contextSummary}>
        <div><dt>Represented area</dt><dd>{representedArea}</dd></div>
        <div><dt>Time period</dt><dd>{filters ? `${periodLabel(filters)} · MYT` : "Not available"}</dd></div>
        <div><dt>Reports in selection</dt><dd>{context.reportCount === null ? "Not available" : `${context.reportCount} reports`}</dd></div>
      </dl>
      <div className={styles.contextActions}>
        <p>Counts are submitted reports, not verified incidents or ecological risk.</p>
        {context.lastSuccessfulUpdateAt && <small>Updated {malaysiaTime(context.lastSuccessfulUpdateAt)} MYT</small>}
        {hasValidSelection && filters && <Link className={styles.secondaryButton} href={`/coordinator/hotspots?${hotspotQuery(filters)}`}>View area on hotspot map ↗</Link>}
      </div>
    </>}
  </section>;
}

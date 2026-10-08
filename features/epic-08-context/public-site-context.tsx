"use client";

import { useEffect, useState } from "react";
import { getExternalContext } from "@/lib/api/iteration3Api";
import type { ExternalContext } from "@/lib/api/iteration3-types";
import styles from "./public-site-context.module.css";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

export function ExternalContextPanel({ siteId }: { siteId: number }) {
  const [context, setContext] = useState<ExternalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getExternalContext(siteId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setContext(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, retryKey]);

  if (context?.state === "site_position_unavailable") return null;

  return <section className={styles.section} aria-labelledby="external-context-heading">
    <div className={styles.heading}><p className={styles.eyebrow}>Regional satellite context</p>
      <h3 id="external-context-heading">Coral bleaching heat stress</h3></div>
    {loading && <p role="status">Loading satellite measurements…</p>}
    {error && <div role="status"><p>Satellite context is unavailable right now.</p>
      <button type="button" onClick={() => { setError(false); setLoading(true); setRetryKey((key) => key + 1); }}>Try again</button></div>}
    {context && <>
      {context.state === "unavailable" && <p>{context.message}</p>}
      {context.state === "available" && <>
        {context.showingLastStoredValues && <p className={styles.caveat}>The latest update could not be fetched; these are the last stored values.</p>}
        <dl className={styles.measurements}>{context.items.map((item) => <div key={item.contextType}>
          <dt>{item.label}</dt><dd>{item.displayValue}</dd>
          <small>Data for <time dateTime={item.representedPeriodEnd ?? undefined}>{dateLabel(item.representedPeriodEnd)}</time></small>
        </div>)}</dl>
        {context.sourceName && <p className={styles.attribution}>Source: {context.sourceUrl
          ? <a href={context.sourceUrl} target="_blank" rel="noreferrer">{context.sourceName}</a>
          : context.sourceName}. {context.attribution}</p>}
      </>}
      <p className={styles.caveat}>{context.interpretationNote}</p>
    </>}
  </section>;
}

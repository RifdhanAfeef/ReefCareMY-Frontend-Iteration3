"use client";

import { useEffect, useState } from "react";
import { getCoordinatorCaseHistory } from "@/lib/api/coordinatorApi";
import type { CoordinatorCase, CoordinatorHistoryItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./triage.module.css";

type HistoryEvent = { title: string; date: string | null; detail?: string | null; actor?: string | null };
const responseLabels = {
  monitoring_only: "Monitoring recommended",
  refer_or_share: "Shared for possible response",
  intervention_required: "Intervention recommended",
};

function displayDate(value: string | null) {
  if (!value) return "Date not returned";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : formatDateTime(date);
}

export function CaseHistoryPanel({ report }: { report: CoordinatorCase }) {
  const lookupClosure = report.statusCode.startsWith("closed_") || report.statusCode === "referred";
  const [closure, setClosure] = useState<CoordinatorHistoryItem | null>(null);
  const [loading, setLoading] = useState(lookupClosure);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!lookupClosure) return;
    let cancelled = false;
    async function loadClosure() {
      // The existing endpoint is owner-scoped and paginated. Match the exact
      // reference; never substitute the first row or use an Observer endpoint.
      for (let page = 1; !cancelled; page += 1) {
        const result = await getCoordinatorCaseHistory({ page, pageSize: 100 });
        if (cancelled) return;
        if (result.page !== page || result.pageSize < 1) throw new Error("Incomplete history response");
        const match = result.items.find((item) => item.reportReference === report.reportReference);
        if (match) { setClosure(match); return; }
        if (page * result.pageSize >= result.total) return;
        if (result.items.length === 0) throw new Error("Incomplete history response");
      }
    }
    loadClosure().catch((requestError) => {
      if (!cancelled) setError(userFacingError(requestError, "Closure and referral history could not be loaded."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lookupClosure, report.reportReference, retryKey]);

  const events: HistoryEvent[] = [{ title: "Report submitted", date: report.submittedAt }];
  for (const entry of report.informationExchange ?? []) {
    events.push({ title: entry.eventType === "info_requested" ? "Additional information requested"
      : entry.eventType === "info_provided" ? "Observer response received" : "Recorded case update",
      date: entry.occurredAt, detail: entry.message, actor: entry.actorDisplayName });
  }
  const decision = report.latestDecision;
  if (decision) events.push({ title: `Latest response decision: ${responseLabels[decision.responseType]}`,
    date: decision.decidedAt ?? null, detail: decision.notes });
  for (const referral of closure?.referrals ?? []) {
    events.push({ title: `Referral recorded: ${referral.referredTo}`, date: referral.referredAt,
      detail: referral.note, actor: referral.decidedByName });
  }
  if (closure) events.push({ title: `Case closed: ${closure.closureReason?.label ?? closure.status.label}`,
    date: closure.closedAt ?? null, detail: closure.closureNote });
  events.sort((a, b) => {
    const left = a.date ? Date.parse(a.date) : NaN;
    const right = b.date ? Date.parse(b.date) : NaN;
    return (Number.isFinite(left) ? left : Infinity) - (Number.isFinite(right) ? right : Infinity);
  });

  return <section className={styles.informationExchange} aria-labelledby="recorded-case-history-heading">
    <h2 id="recorded-case-history-heading">Recorded case history</h2>
    <p><strong>Current status:</strong> {report.statusLabel}</p>
    <p><strong>Current owner:</strong> {report.owner.displayName}</p>
    {loading && <p role="status">Loading closure and referral history…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={() => {
      setClosure(null); setError(""); setLoading(true); setRetryKey((value) => value + 1);
    }}>Retry history</button></div>}
    {lookupClosure && !loading && !error && !closure && <p role="status">No closure details were returned for this report.</p>}
    <ol>{events.map((event, index) => <li key={`${event.title}-${event.date}-${index}`}>
      <strong>{event.title}</strong>
      {event.detail && <p>{event.detail}</p>}
      <small>{event.actor && `${event.actor} · `}
        {event.date && !Number.isNaN(Date.parse(event.date))
          ? <time dateTime={event.date}>{displayDate(event.date)}</time> : displayDate(event.date)}
      </small>
    </li>)}</ol>
    {closure?.wasReferred && <p>A recorded referral does not mean the recipient agreed to act.</p>}
    <p className={styles.muted}>This view shows the case records returned by ReefCare, including the latest response decision. Earlier decision changes may not be available here. Follow-up records are shown separately below.</p>
  </section>;
}

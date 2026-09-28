"use client";

import { useId } from "react";
import type { HotspotFilters, HotspotSummary } from "@/lib/api/hotspot-types";
import { calendarDate } from "./filters";
import styles from "./hotspots.module.css";

const threatColors: Record<string, string> = {
  ghost_gear: "#087e81", coral_bleaching: "#80719b", marine_debris: "#537baf", physical_damage: "#ab763c", unsure: "#7d898c",
};

export function ThreatBreakdown({ summary }: { summary: HotspotSummary }) {
  const largest = Math.max(1, ...summary.threatBreakdown.map((item) => item.reportCount));
  return <section className={styles.card} aria-labelledby="threat-heading"><div className={styles.sectionHeading}><div><h2 id="threat-heading">Reported threats</h2><p>Observer-selected categories, including Unsure</p></div></div>
    <ul className={styles.threatList}>{summary.threatBreakdown.map((item) => <li key={item.code}>
      <div><span><i style={{ background: threatColors[item.code] ?? "#7d898c" }} aria-hidden="true" />{item.label}</span><strong>{item.reportCount.toLocaleString()}</strong></div>
      <div className={styles.barTrack} aria-hidden="true"><div style={{ width: `${100 * item.reportCount / largest}%`, background: threatColors[item.code] ?? "#7d898c" }} /></div>
    </li>)}</ul>
    <p className={styles.finePrint}>These categories do not confirm the presence or severity of a threat.</p>
  </section>;
}

export function ReportingFrequency({ summary, filters }: { summary: HotspotSummary; filters: HotspotFilters }) {
  const id = useId();
  const max = Math.max(1, ...summary.frequency.map((item) => item.reportCount));
  const width = Math.max(320, summary.frequency.length * 14 + 50);
  const plotWidth = width - 56;
  const step = plotWidth / Math.max(1, summary.frequency.length);
  const partialId = `partial-${id.replace(/:/g, "")}`;
  return <section className={styles.card} aria-labelledby="frequency-heading">
    <div className={styles.sectionHeading}><div><h2 id="frequency-heading">Reporting frequency</h2><p>Reports per {filters.interval} · observation dates</p></div></div>
    {summary.trendState === "insufficient_history" && <p className={styles.notice} role="status">{summary.trendMessage}</p>}
    <div className={styles.chartScroll} tabIndex={0} aria-label="Reporting frequency chart; scroll horizontally for longer periods">
      <svg viewBox={`0 0 ${width} 200`} style={{ minWidth: width }} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Reporting frequency by {filters.interval}</title><desc id={`${id}-description`}>{summary.reportCount} reports across {summary.frequency.length} intervals. Exact counts are available in the table below. Hatched bars indicate partial calendar intervals.</desc>
        <defs><pattern id={partialId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#168b8e" /><rect width="2" height="6" fill="#bce4df" /></pattern></defs>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="38" x2={width - 12} y1={158 - fraction * 128} y2={158 - fraction * 128} stroke="#dce7e5" /><text x="29" y={162 - fraction * 128} textAnchor="end" fill="#607c80" fontSize="11">{Number.isInteger(max * fraction) ? max * fraction : ""}</text></g>)}
        {summary.frequency.map((item, index) => {
          const height = item.reportCount / max * 128;
          const x = 42 + index * step;
          return <g key={item.bucketStart}><rect x={x} y={158 - height} width={Math.max(2, step - 5)} height={height} rx="2" fill={item.isPartial ? `url(#${partialId})` : "#168b8e"}><title>{calendarDate(item.includedFrom)} to {calendarDate(item.includedTo)}: {item.reportCount} reports{item.isPartial ? " (partial interval)" : ""}</title></rect>
            {(index === 0 || index === summary.frequency.length - 1 || (summary.frequency.length <= 10 && step > 48)) && <text x={x} y="182" fontSize="10" fill="#607c80" textAnchor={index === summary.frequency.length - 1 ? "end" : "start"}>{item.includedFrom.slice(5)}</text>}
          </g>;
        })}
      </svg>
    </div>
    <p className={styles.finePrint}>Zero-report intervals are included. Hatched bars cover only part of a calendar {filters.interval}; compare them with care.</p>
    <details className={styles.details}><summary>View interval counts</summary><div className={styles.tableScroll}><table><caption className="sr-only">Reporting frequency for the selected observation period</caption><thead><tr><th>Included dates</th><th>Reports</th><th>Interval</th></tr></thead><tbody>{summary.frequency.map((item) => <tr key={item.bucketStart}><td>{calendarDate(item.includedFrom)} – {calendarDate(item.includedTo)}</td><td>{item.reportCount}</td><td>{item.isPartial ? "Partial" : "Full"}</td></tr>)}</tbody></table></div></details>
  </section>;
}

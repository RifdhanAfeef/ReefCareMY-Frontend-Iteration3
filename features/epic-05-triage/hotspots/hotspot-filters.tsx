"use client";

import { useState, type FormEvent } from "react";
import type { HotspotFilters, HotspotInterval, HotspotOptions, HotspotThreat } from "@/lib/api/hotspot-types";
import { validateHotspotFilters } from "./filters";
import styles from "./hotspots.module.css";

export function HotspotFilterForm({ filters, options, onApply, onReset }: {
  filters: HotspotFilters;
  options: HotspotOptions;
  onApply: (filters: HotspotFilters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState<string | null>(null);
  const regions = [...new Set(options.sites.flatMap((site) => site.region ? [site.region] : []))].sort();
  const areas = [...new Set(options.sites.filter((site) => !draft.region || site.region === draft.region).flatMap((site) => site.area ? [site.area] : []))].sort();
  const sites = options.sites.filter((site) => (!draft.region || site.region === draft.region) && (!draft.area || site.area === draft.area));
  const knownSite = sites.some((site) => site.siteId === draft.siteId);

  function apply(event: FormEvent) {
    event.preventDefault();
    const problem = validateHotspotFilters(draft);
    setError(problem);
    if (!problem) onApply(draft);
  }

  return <form className={styles.filterPanel} onSubmit={apply} aria-label="Hotspot filters">
    <div className={styles.sectionHeading}><div><h2>Explore reporting activity</h2><p>Filter by where and when observations were made.</p></div><span className={styles.badge}>Malaysia time · UTC+8</span></div>
    <div className={styles.filterGrid}>
      <label className={styles.field}>State / region<select value={draft.region ?? ""} onChange={(event) => setDraft({ ...draft, region: event.target.value || null, area: null, siteId: null })}>
        <option value="">All regions</option>{draft.region && !regions.includes(draft.region) && <option value={draft.region}>{draft.region}</option>}{regions.map((region) => <option key={region}>{region}</option>)}
      </select></label>
      <label className={styles.field}>Island / area<select value={draft.area ?? ""} onChange={(event) => setDraft({ ...draft, area: event.target.value || null, siteId: null })}>
        <option value="">All areas</option>{draft.area && !areas.includes(draft.area) && <option value={draft.area}>{draft.area}</option>}{areas.map((area) => <option key={area}>{area}</option>)}
      </select></label>
      <label className={styles.field}>Dive site<select value={draft.siteId ?? ""} onChange={(event) => setDraft({ ...draft, siteId: event.target.value ? Number(event.target.value) : null })}>
        <option value="">All dive sites</option>{draft.siteId !== null && !knownSite && <option value={draft.siteId}>Site {draft.siteId} (not in this selection)</option>}{sites.map((site) => <option key={site.siteId} value={site.siteId}>{site.name}</option>)}
      </select></label>
      <label className={styles.field}>Threat category<select value={draft.threat ?? ""} onChange={(event) => setDraft({ ...draft, threat: event.target.value as HotspotThreat || null })}>
        <option value="">All threats (including Unsure)</option>{options.threats.map((threat) => <option key={threat.code} value={threat.code}>{threat.label}</option>)}
      </select></label>
      <label className={styles.field}>Observed from<input type="date" required value={draft.observedFrom} onChange={(event) => setDraft({ ...draft, observedFrom: event.target.value })} /></label>
      <label className={styles.field}>Observed to<input type="date" required value={draft.observedTo} onChange={(event) => setDraft({ ...draft, observedTo: event.target.value })} /></label>
      <label className={styles.field}>Reporting interval<select value={draft.interval} onChange={(event) => setDraft({ ...draft, interval: event.target.value as HotspotInterval })}>
        <option value="day">Daily</option><option value="week">Weekly · Monday start</option><option value="month">Monthly</option>
      </select></label>
      <div className={styles.filterActions}><button className={styles.primaryButton} type="submit">Apply filters</button><button className={styles.resetButton} type="button" onClick={onReset}>Reset</button></div>
    </div>
    {error && <p className={styles.validation} role="alert">{error}</p>}
    <p className={styles.finePrint}>Dates are inclusive. Select up to {options.maxPeriodDays} days. Site selections use named-site membership, not precise incident boundaries.</p>
  </form>;
}

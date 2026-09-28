"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { claimReport } from "@/lib/api/coordinatorApi";
import { ApiError } from "@/lib/api/client";
import { getHotspotIntake } from "@/lib/api/hotspotsApi";
import type { HotspotIntakeItem } from "@/lib/api/hotspot-types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { malaysiaTime } from "./filters";
import { HotspotError, HotspotLoading } from "./hotspot-status";
import { useHotspotResource } from "./use-hotspot-resource";
import styles from "./hotspots.module.css";

export function HotspotIntakePage({ reportReference }: { reportReference: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [revision, setRevision] = useState(0);
  const [latest, setLatest] = useState<HotspotIntakeItem | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimed, setClaimed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback((signal: AbortSignal) => getHotspotIntake(reportReference, signal), [reportReference]);
  const result = useHotspotResource(`intake:${reportReference}:${revision}`, load);
  const report = latest ?? result.data;
  const back = `/coordinator/hotspots${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const reviewHref = `/coordinator/reports/${encodeURIComponent(reportReference)}`;

  function refresh() { setLatest(null); setClaimError(""); setRevision((value) => value + 1); }

  async function confirmClaim() {
    setClaiming(true);
    setClaimError("");
    try {
      const current = await getHotspotIntake(reportReference);
      if (!mounted.current) return;
      setLatest(current);
      if (current.nextAction !== "claim") {
        setClaimError("Ownership has changed. The permitted summary has been refreshed.");
        return;
      }
      await claimReport(reportReference);
      if (mounted.current) { setClaimed(true); router.push(reviewHref); }
    } catch (error) {
      if (!mounted.current) return;
      setClaimError(userFacingError(error, "The report could not be claimed. Refresh its ownership and try again."));
      if (error instanceof ApiError && error.status === 409) {
        try {
          const current = await getHotspotIntake(reportReference);
          if (mounted.current) setLatest(current);
        } catch {
          if (mounted.current) { setLatest(null); setRevision((value) => value + 1); }
        }
      }
    } finally { if (mounted.current) setClaiming(false); }
  }

  return <div className={styles.page}>
    <Link href={back} className={styles.textLink}>← Back to geographic analysis</Link>
    <header className={styles.pageHeading}><div><p className={styles.eyebrow}>Geographic analysis / Report intake</p><h1>{report?.nextAction === "claim" && !claimed ? "Claim this report" : "Report intake summary"}</h1><p>Inspect permitted information before entering the case workflow.</p></div></header>
    {result.loading && !latest ? <HotspotLoading message="Checking current report ownership…" /> : !report ? <HotspotError title="Report summary unavailable" error={result.error} onRetry={refresh} /> : <section className={`${styles.card} ${styles.intakeCard}`}>
      <div className={styles.sectionHeading}><h2>{report.reportReference}</h2><span className={styles.badge}>{report.statusLabel}</span></div>
      <dl className={styles.intakeDetails}><div><dt>Reported threat</dt><dd>{report.threat}</dd></div><div><dt>Named dive site</dt><dd>{report.site?.name ?? "Not recorded"}</dd></div><div><dt>General area</dt><dd>{report.site?.area ?? "Not recorded"}</dd></div><div><dt>Observed · Malaysia time</dt><dd>{malaysiaTime(report.observedAt)}</dd></div><div><dt>Submitted · Malaysia time</dt><dd>{malaysiaTime(report.submittedAt)}</dd></div><div><dt>Ownership</dt><dd>{report.ownerDisplayName ?? (report.ownership === "unclaimed" ? "Unclaimed" : "Assigned")}</dd></div></dl>
      {report.nextAction === "claim" && !claimed && <div className={styles.notice}><strong>Claiming records responsibility, not a verdict</strong><p>Claim this report to become its active coordinator and open the authorised review page. Evidence and protected locations are available only after a successful claim.</p></div>}
      {report.nextAction === "assigned_summary" && <div className={styles.notice}><strong>Assigned to another coordinator</strong><p>This permitted summary is available for context. Protected evidence, locations and case controls remain restricted to the authorised owner.</p></div>}
      {report.nextAction === "restricted_summary" && <div className={styles.notice}><strong>Closed report with no current owner</strong><p>This historical summary is available for context. Claiming is not offered for this report.</p></div>}
      {report.statusCode === "evidence_accepted" && <p className={styles.finePrint}>Evidence Accepted records a desk assessment; it does not mean on-site verification.</p>}
      {claimError && <p className={styles.validation} role="alert">{claimError}</p>}
      {claimed && <p className={styles.notice} role="status">The report was claimed successfully. Opening your authorised case…</p>}
      <div className={styles.actions}>
        {report.nextAction === "claim" && !claimed && <button className={styles.primaryButton} type="button" onClick={confirmClaim} disabled={claiming}>{claiming ? "Checking and claiming…" : "Claim and open report"}</button>}
        {(report.nextAction === "review" || claimed) && <Link className={styles.primaryButton} href={reviewHref}>Open authorised review</Link>}
        <button type="button" className={styles.secondaryButton} onClick={refresh} disabled={claiming || claimed}>Refresh ownership</button><Link href={back} className={styles.textLink}>Return to analysis</Link>
      </div>
    </section>}
  </div>;
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  claimAndCompare, compareReports, decideRelationship, getRejectionReasons, getRelatedReports,
} from "@/lib/api/iteration3Api";
import { getCoordinatorEvidence } from "@/lib/api/coordinatorApi";
import { ApiError } from "@/lib/api/client";
import type { ComparedReport, RelatedComparison, RelatedReports, RejectionReason } from "@/lib/api/iteration3-types";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./related-reports.module.css";

function EvidenceImage({ reference, evidenceId }: { reference: string; evidenceId: number }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    getCoordinatorEvidence(reference, evidenceId).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [reference, evidenceId]);
  if (error) return <span className={styles.evidenceUnavailable}>Image unavailable</span>;
  if (!url) return <span className={styles.evidenceUnavailable}>Loading image…</span>;
  return <Image src={url} alt={`Evidence for report ${reference}`} width={110} height={82} unoptimized />;
}

function ReportSide({ report }: { report: ComparedReport }) {
  return <article className={styles.reportSide}>
    <div className={styles.reportHeading}><h4>{report.reportReference}</h4><span>{report.statusLabel}</span></div>
    <dl className={styles.facts}>
      <div><dt>Threat</dt><dd>{report.threatCategoryLabel ?? "Not specified"}</dd></div>
      <div><dt>Dive site</dt><dd>{[report.diveSiteName, report.publicAreaLabel].filter(Boolean).join(" · ") || "Not specified"}</dd></div>
      <div><dt>Observed</dt><dd>{report.observedAt ? new Date(report.observedAt).toLocaleString("en-MY") : "Not specified"}</dd></div>
      <div><dt>Depth</dt><dd>{report.estimatedDepthMetres == null ? "Not specified" : `${report.estimatedDepthMetres} m`}</dd></div>
    </dl>
    {report.evidence?.length > 0 && <div className={styles.evidenceGrid}>{report.evidence.map((evidence) =>
      <EvidenceImage key={evidence.evidenceId} reference={report.reportReference} evidenceId={evidence.evidenceId} />)}</div>}
    <details className={styles.moreDetails}><summary>More report details</summary>
      <p><strong>Location accuracy:</strong> {report.locationConfidenceCode?.replaceAll("_", " ") ?? "Not specified"}</p>
      <p><strong>Incident:</strong> {report.incidentReference ?? "Not linked"}</p>
      {report.description && <p className={styles.description}><strong>Description:</strong> {report.description}</p>}
    </details>
  </article>;
}

export function RelatedReportsPanel({ reportReference }: { reportReference: string }) {
  const [result, setResult] = useState<RelatedReports | null>(null);
  const [comparison, setComparison] = useState<RelatedComparison | null>(null);
  const [candidateReference, setCandidateReference] = useState("");
  const [reasons, setReasons] = useState<RejectionReason[]>([]);
  const [decision, setDecision] = useState<"same_incident" | "not_related" | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedCandidate = result?.candidates.find((candidate) => candidate.candidateReportReference === candidateReference);
  const canDecide = selectedCandidate?.decisionState === "undecided" || selectedCandidate?.reopenedByNewEvidence;

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    getRelatedReports(reportReference, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setResult(data); setError(""); setLoading(false); }
    }).catch((requestError) => {
      if (!controller.signal.aborted) { setError(userFacingError(requestError, "Related reports could not be loaded.")); setLoading(false); }
    });
    return () => controller.abort();
  }, [reportReference, refreshKey]);

  async function openComparison(reference: string, unclaimed: boolean) {
    setPending(true); setError(""); setSuccess("");
    try {
      const data = unclaimed
        ? await claimAndCompare(reportReference, reference)
        : await compareReports(reportReference, reference);
      setCandidateReference(reference);
      setComparison(data);
      setDecision(null);
      if (unclaimed) refresh();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        setError("This report is no longer available to claim. The candidate list has been refreshed.");
        refresh();
      } else setError(userFacingError(requestError, "The comparison could not be opened."));
    } finally { setPending(false); }
  }

  async function chooseDecision(value: "same_incident" | "not_related") {
    setDecision(value); setError(""); setReasonCode(""); setNote("");
    if (value === "not_related" && reasons.length === 0) {
      try { setReasons(await getRejectionReasons()); }
      catch (requestError) { setError(userFacingError(requestError, "Rejection reasons could not be loaded.")); }
    }
  }

  async function saveDecision() {
    if (!comparison || !decision) return;
    const reason = reasons.find((option) => option.code === reasonCode);
    if (decision === "not_related" && (!reason || (reason.requiresNote && !note.trim()))) {
      setError("Select a reason and add a note if required."); return;
    }
    setPending(true); setError("");
    try {
      const saved = await decideRelationship(reportReference, candidateReference, {
        decision,
        ...(decision === "not_related" ? { rejectionReasonCode: reasonCode } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSuccess(decision === "same_incident"
        ? `The reports were linked under ${saved.incidentReference}.`
        : "The reports were recorded as not related.");
      setComparison(null); setDecision(null); refresh();
    } catch (requestError) {
      setError(userFacingError(requestError, "The relationship decision could not be saved."));
      if (requestError instanceof ApiError && requestError.status === 409) refresh();
    } finally { setPending(false); }
  }

  return <section className={styles.panel} aria-labelledby="related-reports-heading">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Report comparison</p><h2 id="related-reports-heading">Potentially related reports</h2></div>
      <button type="button" onClick={refresh} disabled={pending} className={styles.secondary}>Refresh analysis</button>
    </header>
    <p className={styles.caveat}>Suggestions help you compare reports; only your decision links them. Candidates are unclaimed or already owned by you.</p>
    {loading && <p role="status">Loading related-report analysis…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {success && <p role="status" className={styles.success}>{success}</p>}
    {result && <p role="status">{result.message || ({
      processing: "Related-report analysis is in progress.",
      matches_available: "Potential matches are ready for review.",
      insufficient_information: "There is not enough information to compare reports.",
      no_available_matches: "No related reports are available to you.",
      unavailable: "Related-report analysis is unavailable. You can continue reviewing this case.",
    })[result.analysisState]}</p>}
    {result?.analysisState === "matches_available" && result.candidates.length > 0 && <ul className={styles.candidates}>
      {result.candidates.map((candidate) => <li key={candidate.candidateReportReference}>
        <div className={styles.candidateInfo}><div className={styles.candidateHeading}><strong>{candidate.candidateReportReference}</strong><span className={styles.badge}>{candidate.relatednessLevel} similarity</span><span className={styles.ownerBadge}>{candidate.ownershipState === "unclaimed" ? "Unclaimed" : "Your case"}</span></div>
          <ul className={styles.signals} aria-label="Similarity signals">{candidate.signals.slice(0, 3).map((signal) => <li key={signal.code}>{signal.label}</li>)}{candidate.signals.length > 3 && <li>+{candidate.signals.length - 3} more</li>}</ul>
          {candidate.signals.some((signal) => signal.detail) && <details className={styles.signalDetails}><summary>Why was this suggested?</summary><ul>{candidate.signals.map((signal) => <li key={signal.code}><strong>{signal.label}</strong>{signal.detail && ` — ${signal.detail}`}</li>)}</ul></details>}
          {candidate.reopenedByNewEvidence && <small>New evidence prompted another review.</small>}
          {candidate.decisionState !== "undecided" && <small>Previous decision: {candidate.decisionState === "linked" ? "Same incident" : "Not related"}</small>}
        </div>
        <button type="button" className={styles.secondary} disabled={pending}
          onClick={() => openComparison(candidate.candidateReportReference, candidate.ownershipState === "unclaimed")}>
          {candidate.ownershipState === "unclaimed" ? "Claim and compare" : "Compare reports"}
        </button>
      </li>)}
    </ul>}
    {comparison && <div className={styles.comparison}>
      <div className={styles.compareHeading}><h3>Compare reports</h3><button type="button" className={styles.secondary} onClick={() => { setComparison(null); setDecision(null); }}>Close comparison</button></div>
      <p className={styles.compareIntro}>Check the key facts and photos, then record your decision.</p>
      <div className={styles.compareGrid}><ReportSide report={comparison.current} /><ReportSide report={comparison.candidate} /></div>
      {comparison.signals.length > 0 && <div className={styles.matchSummary}><strong>Why they may be related</strong><ul className={styles.signals}>{comparison.signals.map((signal) => <li key={signal.code}>{signal.label}</li>)}</ul></div>}
      {canDecide ? <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => chooseDecision("not_related")}>Not related</button>
        <button type="button" className={styles.primary} onClick={() => chooseDecision("same_incident")}>Confirm same incident</button>
      </div> : <p>This relationship already has a recorded decision.</p>}
      {decision && <div className={styles.decisionBox}>
        <h4>{decision === "same_incident" ? "Confirm the relationship" : "Record why these are not related"}</h4>
        <p>{decision === "same_incident"
          ? "This links both original reports under one incident reference. Each report keeps its own history and evidence."
          : "This decision will be saved. New evidence can prompt another review."}</p>
        {decision === "not_related" && <label>Reason
          <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
            <option value="">Select a reason</option>{reasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
          </select>
        </label>}
        <label>Note {decision === "not_related" && reasons.find((reason) => reason.code === reasonCode)?.requiresNote ? "(required)" : "(optional)"}
          <textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setDecision(null)}>Cancel</button>
          <button type="button" className={styles.primary} disabled={pending || (decision === "not_related" && reasons.length === 0)} onClick={saveDecision}>{pending ? "Saving…" : "Save decision"}</button></div>
      </div>}
    </div>}
  </section>;
}

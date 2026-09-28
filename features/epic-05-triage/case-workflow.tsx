"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  claimReport,
  closeCase as closeCoordinatorCase,
  getCoordinatorCase,
  getCoordinatorEvidence,
  recordEvidenceAssessment,
  recordCaseDecision,
  requestMoreInformation,
  startReview,
} from "@/lib/api/coordinatorApi";
import { ApiError } from "@/lib/api/client";
import type { ClaimedCase, ClosureReasonCode, CoordinatorAiAssisted, CoordinatorCase, ResponseType } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { formatDateTime } from "@/lib/format/date";
import { ConservationActionPanel } from "@/features/epic-07-actions/conservation-action-panel";
import { closureReasons, type ReviewOutcome } from "./triage-data";
import { HotspotCaseContext } from "./hotspots/hotspot-context";
import styles from "./triage.module.css";

type Stage = "detail" | "assess" | "request" | "request-sent" | "response" | "response-saved" | "referral" | "close" | "closed";
type EvidenceAnswer = "yes" | "no" | "";
type RouteState = "claim" | "loading" | "ready" | "error";

const requestChoices = [
  ["clearer-photo", "A clearer photograph showing the issue"],
  ["wider-photo", "A wider photograph of the surrounding reef"],
  ["location", "A more accurate location"],
  ["details", "Additional observation details"],
] as const;

const responseLabels: Record<ResponseType, string> = {
  monitoring_only: "Monitoring Recommended",
  refer_or_share: "Shared for Possible Response",
  intervention_required: "Intervention Recommended",
};

const defaultResponseNote = "The accepted evidence should be retained for an appropriate follow-up response.";
const decisionStoragePrefix = "reefcare.coordinator-decision.";

type RestorableDecision = {
  responseType: ResponseType;
  notes?: string | null;
  referredTo?: string | null;
};

function reviewOutcomeFor(responseType: ResponseType): Exclude<ReviewOutcome, "not_substantiated" | null> {
  if (responseType === "monitoring_only") return "monitoring";
  if (responseType === "refer_or_share") return "referral";
  return "intervention";
}

function parseStoredDecision(value: string | null): RestorableDecision | null {
  try {
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<RestorableDecision>;
    if (!parsed.responseType || !Object.hasOwn(responseLabels, parsed.responseType)) return null;
    return parsed as RestorableDecision;
  } catch {
    return null;
  }
}

function subscribeToStoredDecision() {
  return () => undefined;
}

function getServerDecisionSnapshot() {
  return null;
}

function storeDecision(reportReference: string, decision: RestorableDecision) {
  try {
    window.sessionStorage.setItem(`${decisionStoragePrefix}${reportReference}`, JSON.stringify(decision));
  } catch {
    // The backend remains the source of truth when browser storage is unavailable.
  }
}

function clearStoredDecision(reportReference: string) {
  try {
    window.sessionStorage.removeItem(`${decisionStoragePrefix}${reportReference}`);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className={styles.heading}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function displayDateTime(value?: string | null) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

function informationExchangeLabel(eventType: string) {
  if (eventType === "info_requested") return "Coordinator request";
  if (eventType === "info_provided") return "Observer response";
  return formatFieldName(eventType);
}

function formatFieldName(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

type AiStructuredItem = {
  key: string;
  field: string;
  label: string;
  value: string;
  provenanceLabel: string;
};

function displayAiValue(value: unknown): string {
  if (value == null || value === "") return "Not specified";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayAiValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${formatFieldName(key)}: ${displayAiValue(nestedValue)}`)
      .join("; ");
  }
  return "Not specified";
}

function aiStructuredItems(suggestions: CoordinatorAiAssisted["suggestions"] | undefined): AiStructuredItem[] {
  if (!Array.isArray(suggestions)) return [];

  return suggestions.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const field = typeof item.field === "string" ? item.field : `structured-item-${index + 1}`;
    const label = typeof item.label === "string" ? item.label : formatFieldName(field);
    // The claimed-case endpoint returns `value` as the final submitted value
    // reviewed by the Observer. It must take precedence over any legacy raw
    // suggestion fields that may appear in an older or mixed response.
    const legacyItem = item as unknown as Record<string, unknown>;
    const value = item.value ?? legacyItem.observerValue ?? legacyItem.suggestedValue ?? legacyItem.suggestion;
    const status = typeof item.status === "string" ? item.status.toLowerCase() : "";
    // US5.2 only permits Observer-reviewed values in the case view. Raw,
    // unresolved or removed model output must not be presented as case facts.
    if (status !== "confirmed" && status !== "corrected") return [];
    const provenanceLabel = status === "corrected"
      ? "AI-assisted · edited by Observer"
      : "AI-assisted · accepted by Observer";
    return [{ key: `${field}-${index}`, field, label, value: displayAiValue(value), provenanceLabel }];
  });
}

function normaliseAiField(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findAiItem(items: AiStructuredItem[], aliases: string[]): AiStructuredItem | undefined {
  const normalisedAliases = aliases.map(normaliseAiField);
  return items.find((item) => {
    const candidates = [normaliseAiField(item.field), normaliseAiField(item.label)];
    return candidates.some((candidate) => normalisedAliases.includes(candidate));
  });
}

function AiProvenanceIndicator({ item }: { item: AiStructuredItem }) {
  return <small className={styles.inlineAiProvenance}>{item.provenanceLabel}</small>;
}

function formatEvidenceField(key: string, value: string | number | boolean) {
  if ((key === "uploadedAt" || key === "capturedAt") && typeof value === "string") {
    return displayDateTime(value);
  }
  return String(value);
}

function SecureEvidencePreview({ reportReference, evidenceId }: { reportReference: string; evidenceId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    getCoordinatorEvidence(reportReference, evidenceId)
      .then((evidence) => {
        objectUrl = URL.createObjectURL(evidence);
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setEvidenceUrl(objectUrl);
      })
      .catch((requestError) => {
        if (!cancelled) setError(userFacingError(requestError, "The evidence image could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceId, reportReference, retryKey]);

  function retryEvidence() {
    setLoading(true);
    setError("");
    setRetryKey((value) => value + 1);
  }

  return <div className={styles.evidenceAction}>
    {loading && <div className={styles.evidenceLoading} role="status">Loading evidence…</div>}
    {evidenceUrl && <Image className={styles.evidencePreview} src={evidenceUrl} alt={`Submitted evidence ${evidenceId}`} width={320} height={240} unoptimized />}
    {error && <div><p className={styles.errorText} role="alert">{error}</p><button className={styles.evidenceButton} type="button" onClick={retryEvidence}>Try again</button></div>}
  </div>;
}

function EvidenceRecords({ reportReference, evidence }: { reportReference: string; evidence: CoordinatorCase["evidence"] }) {
  if (evidence.length === 0) {
    return <div className={styles.queueMessage} role="status"><strong>No evidence metadata was returned</strong><p>The case can still be reviewed using the submitted observation details.</p></div>;
  }

  return <div className={styles.evidenceRecords}>{evidence.map((item, index) => {
    const fields = Object.entries(item).filter(([key, value]) => key !== "evidenceId" && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"));
    return <article className={styles.evidenceRecord} key={item.evidenceId}>
      <SecureEvidencePreview reportReference={reportReference} evidenceId={item.evidenceId} />
      <div><strong>Evidence {index + 1}</strong>{fields.length === 0 && <p className={styles.muted}>Evidence is attached to this report.</p>}{fields.length > 0 && <dl className={styles.compactDetails}>{fields.map(([key, value]) => <div key={key}><dt>{formatFieldName(key)}</dt><dd>{formatEvidenceField(key, value as string | number | boolean)}</dd></div>)}</dl>}</div>
    </article>;
  })}</div>;
}

export function CoordinatorCaseRoute({ reportReference, startWithClaim = false }: { reportReference: string; startWithClaim?: boolean }) {
  const [routeState, setRouteState] = useState<RouteState>(startWithClaim ? "claim" : "loading");
  const [report, setReport] = useState<CoordinatorCase | null>(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimConfirmation, setClaimConfirmation] = useState<ClaimedCase | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (startWithClaim && reloadKey === 0) return;
    let cancelled = false;
    getCoordinatorCase(reportReference).then((caseRecord) => {
      if (cancelled) return;
      setReport(caseRecord);
      setRouteState("ready");
    }).catch((requestError) => {
      if (cancelled) return;
      setError(userFacingError(requestError, "The case could not be loaded."));
      setRouteState("error");
    });
    return () => { cancelled = true; };
  }, [reloadKey, reportReference, startWithClaim]);

  async function confirmClaim() {
    setClaiming(true);
    setError("");
    try {
      const claimedCase = await claimReport(reportReference);
      setClaimConfirmation(claimedCase);

      let caseRecord: CoordinatorCase;
      try {
        caseRecord = await getCoordinatorCase(reportReference);
      } catch (requestError) {
        setError(`The report was claimed successfully, but its details could not be loaded. ${userFacingError(requestError, "Try loading the case again.")}`);
        setRouteState("error");
        return;
      }

      if (window.location.protocol !== "about:") {
        window.history.replaceState(
          window.history.state,
          "",
          `/coordinator/reports/${encodeURIComponent(reportReference)}`,
        );
      }
      setReport(caseRecord);
      setRouteState("ready");
    } catch (requestError) {
      setError(userFacingError(requestError, "The report could not be claimed."));
    } finally {
      setClaiming(false);
    }
  }

  async function refreshCase() {
    const caseRecord = await getCoordinatorCase(reportReference);
    setReport(caseRecord);
    return caseRecord;
  }

  if (routeState === "claim") return <section className={styles.page}>
    <Heading eyebrow={`Report intake / ${reportReference}`} title="Claim this report" description="Become the active Case Coordinator before opening protected evidence and decision controls." />
    <section className={styles.card}>
      <h2>Incoming report</h2>
      <div className={styles.summaryGrid}><div><span>Report reference</span><strong>{reportReference}</strong></div><div><span>Current queue state</span><strong>Available to claim</strong></div></div>
      <aside className={styles.warningBox}><strong>Claiming records ownership — not a verdict</strong><p>You will become responsible for reviewing this report. Its evidence status will not change until you assess it.</p></aside>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
      <div className={styles.splitActions}><Link className={styles.secondaryButton} href="/coordinator/report-queue">Cancel</Link><button className={styles.primaryButton} type="button" onClick={confirmClaim} disabled={claiming}>{claiming ? "Claiming report…" : "Claim and open report"}</button></div>
    </section>
  </section>;

  if (routeState === "loading") return <section className={styles.page}><Heading eyebrow="Coordinator workspace" title="Loading case" description="Retrieving the latest protected case details from ReefCare MY." /><div className={styles.queueMessage} role="status"><strong>Loading report {reportReference}…</strong></div></section>;

  if (routeState === "error" || !report) return <section className={styles.page}>
    <Heading eyebrow="Coordinator workspace" title="Case unavailable" description="This case could not be opened for the signed-in coordinator." />
    <section className={styles.card}><div className={styles.errorBox} role="alert"><strong>Unable to open report {reportReference}</strong><p>{error}</p></div><div className={styles.actions}><Link className={styles.secondaryButton} href="/coordinator/report-queue">Return to report queue</Link><button className={styles.primaryButton} type="button" onClick={() => { setRouteState("loading"); setError(""); setReloadKey((value) => value + 1); }}>Try again</button></div></section>
  </section>;

  return <CaseWorkflow report={report} refreshCase={refreshCase} claimConfirmation={claimConfirmation} />;
}

function CaseWorkflow({ report, refreshCase, claimConfirmation }: { report: CoordinatorCase; refreshCase: () => Promise<CoordinatorCase>; claimConfirmation: ClaimedCase | null }) {
  const [stage, setStage] = useState<Stage>("detail");
  const [usable, setUsable] = useState<EvidenceAnswer>("");
  const [credible, setCredible] = useState<EvidenceAnswer>("");
  const [decisionNote, setDecisionNote] = useState("");
  const [assessmentError, setAssessmentError] = useState("");
  const [requestItems, setRequestItems] = useState<string[]>(["clearer-photo", "details"]);
  const [requestMessage, setRequestMessage] = useState("Please add a wider photograph and clarify how the issue was positioned on the reef.");
  const [requestError, setRequestError] = useState("");
  const [requestFromAssessment, setRequestFromAssessment] = useState(false);
  const [responseType, setResponseType] = useState<ResponseType | "">("");
  const [responseNote, setResponseNote] = useState(defaultResponseNote);
  const [responseError, setResponseError] = useState("");
  const [reviewOutcome, setReviewOutcome] = useState<ReviewOutcome>(null);
  const [savedResponse, setSavedResponse] = useState("");
  const [responder, setResponder] = useState("");
  const [referralNote, setReferralNote] = useState("Shared for consideration; no action commitment has been recorded.");
  const [referralError, setReferralError] = useState("");
  const [closureReason, setClosureReason] = useState<ClosureReasonCode | "">("");
  const [closureNote, setClosureNote] = useState("");
  const [closureError, setClosureError] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(report.statusCode);
  const [dismissedRestoredDecision, setDismissedRestoredDecision] = useState(false);
  const [actionEvidenceIds, setActionEvidenceIds] = useState<number[]>([]);
  const closure = closureReasons.find((item) => item.value === closureReason);
  const allowedClosures = useMemo(() => closureReasons.filter((item) => item.allowedOutcomes.includes(reviewOutcome)), [reviewOutcome]);
  const storedDecisionValue = useSyncExternalStore(
    subscribeToStoredDecision,
    () => window.sessionStorage.getItem(`${decisionStoragePrefix}${report.reportReference}`),
    getServerDecisionSnapshot,
  );
  const restoredDecision = report.latestDecision ?? parseStoredDecision(storedDecisionValue);
  const handleActionEvidenceIds = useCallback((evidenceIds: number[]) => {
    setActionEvidenceIds((current) => {
      const next = [...new Set(evidenceIds)].sort((left, right) => left - right);
      return current.length === next.length && current.every((id, index) => id === next[index])
        ? current
        : next;
    });
  }, []);
  const activeStage = stage === "detail" &&
    currentStatus === "evidence_accepted" &&
    restoredDecision &&
    !dismissedRestoredDecision
    ? "response-saved"
    : stage;

  const toggleRequestItem = (value: string) => setRequestItems((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  async function beginAssessment() {
    if (currentStatus !== "claimed") {
      setStage(currentStatus === "evidence_accepted" ? "response" : "assess");
      return;
    }

    setPendingAction("start-review");
    setAssessmentError("");
    try {
      const result = await startReview(report.reportReference);
      setCurrentStatus(result.statusCode);
      await refreshCase();
      setStage("assess");
    } catch (requestError) {
      setAssessmentError(userFacingError(requestError, "The evidence review could not be started."));
    } finally {
      setPendingAction(null);
    }
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usable || (usable === "yes" && !credible)) { setAssessmentError("Answer all required evidence questions before continuing."); return; }
    setAssessmentError("");
    if (usable === "no") { setReviewOutcome(null); setRequestFromAssessment(true); setStage("request"); return; }
    setPendingAction("assessment");
    try {
      const result = await recordEvidenceAssessment(report.reportReference, {
        evidenceUsable: true,
        observationCredible: credible === "yes",
        notes: decisionNote.trim() || undefined,
      });
      setCurrentStatus(result.status);
      if (result.status === "evidence_accepted") {
        setStage("response");
      } else if (result.status === "closed_not_substantiated") {
        setReviewOutcome("not_substantiated");
        setClosureReason("not_substantiated");
        setClosureNote("The submitted observation could not be substantiated from the available evidence.");
        setStage("closed");
      } else {
        await refreshCase();
        setStage("detail");
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        try {
          const latestCase = await refreshCase();
          setCurrentStatus(latestCase.statusCode);
          if (latestCase.statusCode === "closed_not_substantiated") {
            setReviewOutcome("not_substantiated");
            setClosureReason("not_substantiated");
            setClosureNote("The submitted observation could not be substantiated from the available evidence.");
            setStage("closed");
          } else {
            setAssessmentError(`This case is now ${latestCase.statusLabel}. Return to the case and continue from its latest state.`);
          }
        } catch {
          setAssessmentError("The case changed while the assessment was being saved. Return to the case and load its latest state.");
        }
      } else {
        setAssessmentError(userFacingError(requestError, "The evidence assessment could not be saved."));
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedLabels = requestChoices.filter(([value]) => requestItems.includes(value)).map(([, label]) => label);
    const reason = `${selectedLabels.join("; ")}. ${requestMessage.trim()}`.trim();
    if (requestItems.length === 0 || !requestMessage.trim()) { setRequestError("Select at least one missing item and enter a message to the observer."); return; }
    if (reason.length > 500) { setRequestError("The selected items and message must total 500 characters or fewer."); return; }
    setPendingAction("request"); setRequestError("");
    try {
      if (requestFromAssessment) {
        const result = await recordEvidenceAssessment(report.reportReference, {
          evidenceUsable: false,
          notes: reason,
        });
        setCurrentStatus(result.status);
      } else {
        await requestMoreInformation(report.reportReference, reason);
        setCurrentStatus("needs_more_info");
      }
      setStage("request-sent");
    }
    catch (requestErrorValue) { setRequestError(userFacingError(requestErrorValue, "The information request could not be sent.")); }
    finally { setPendingAction(null); }
  }

  function combinedDecisionNotes() {
    return [responseNote.trim(), "Desk review: evidence usable; reported threat plausible.", decisionNote.trim()].filter(Boolean).join(" ");
  }

  async function saveResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!responseType) { setResponseError("Choose the most appropriate response before continuing."); return; }
    setResponseError("");
    if (responseType === "refer_or_share") { setReviewOutcome("referral"); setStage("referral"); return; }
    if (currentStatus !== "evidence_accepted") {
      setResponseError("A response can only be recorded after the evidence assessment has been accepted. Refresh the case and try again.");
      return;
    }
    setPendingAction("decision");
    try {
      const notes = combinedDecisionNotes();
      await recordCaseDecision(report.reportReference, { responseType, notes });
      storeDecision(report.reportReference, { responseType, notes });
      setReviewOutcome(reviewOutcomeFor(responseType));
      setSavedResponse(responseLabels[responseType]); setClosureReason(""); setClosureNote(""); setStage("response-saved");
    } catch (requestErrorValue) { setResponseError(userFacingError(requestErrorValue, "The response decision could not be recorded.")); }
    finally { setPendingAction(null); }
  }

  async function confirmReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!responder.trim() || !referralNote.trim()) { setReferralError("Enter the recipient organisation or contact and a sharing note."); return; }
    setPendingAction("referral"); setReferralError("");
    try {
      const notes = `${combinedDecisionNotes()} ${referralNote.trim()}`.trim();
      const referredTo = responder.trim();
      await recordCaseDecision(report.reportReference, { responseType: "refer_or_share", notes, referredTo });
      storeDecision(report.reportReference, { responseType: "refer_or_share", notes, referredTo });
      setReviewOutcome("referral"); setSavedResponse(responseLabels.refer_or_share); setClosureReason("referred_other_org"); setClosureNote(referralNote.trim()); setStage("close");
    } catch (requestErrorValue) { setReferralError(userFacingError(requestErrorValue, "The referral decision could not be recorded.")); }
    finally { setPendingAction(null); }
  }

  async function closeWithoutPartner() {
    setPendingAction("referral"); setReferralError("");
    try {
      const notes = `${combinedDecisionNotes()} No participating response partner is currently available.`.trim();
      await recordCaseDecision(report.reportReference, { responseType: "intervention_required", notes });
      storeDecision(report.reportReference, { responseType: "intervention_required", notes });
      setResponseType("intervention_required"); setReviewOutcome("intervention"); setSavedResponse(responseLabels.intervention_required); setClosureReason("no_responsible_partner"); setClosureNote("No participating response partner is currently available for this report."); setStage("close");
    } catch (requestErrorValue) { setReferralError(userFacingError(requestErrorValue, "The response decision could not be recorded.")); }
    finally { setPendingAction(null); }
  }

  async function submitClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closureReason || !allowedClosures.some((item) => item.value === closureReason)) { setClosureError("Select one valid closure reason for the recorded assessment and response."); return; }
    if (!closureNote.trim()) { setClosureError("Enter a closure note explaining the recorded outcome."); return; }
    setPendingAction("closure"); setClosureError("");
    try {
      await closeCoordinatorCase(report.reportReference, { closureReasonCode: closureReason, publicClosureNote: closureNote.trim(), ...(reviewOutcome === "referral" && responder ? { referredTo: responder } : {}) });
      clearStoredDecision(report.reportReference);
      setStage("closed");
    } catch (requestErrorValue) { setClosureError(userFacingError(requestErrorValue, "The case could not be closed.")); }
    finally { setPendingAction(null); }
  }

  async function returnToDetail() {
    setPendingAction("refresh");
    try { await refreshCase(); setDismissedRestoredDecision(true); setStage("detail"); }
    catch (requestErrorValue) { setResponseError(userFacingError(requestErrorValue, "The updated case could not be loaded.")); }
    finally { setPendingAction(null); }
  }

  function openClosure() {
    if (restoredDecision && !savedResponse) {
      setResponseType(restoredDecision.responseType);
      setResponseNote(restoredDecision.notes?.trim() || defaultResponseNote);
      setResponder(restoredDecision.referredTo?.trim() ?? "");
      setReviewOutcome(reviewOutcomeFor(restoredDecision.responseType));
      setSavedResponse(responseLabels[restoredDecision.responseType]);
    }
    setStage("close");
  }

  const exactLocation = report.preciseLocation?.latitude != null && report.preciseLocation.longitude != null ? `${report.preciseLocation.latitude.toFixed(6)}, ${report.preciseLocation.longitude.toFixed(6)}` : "No exact coordinates were submitted";
  const uncertainty = report.preciseLocation?.uncertaintyMetres != null ? `Estimated uncertainty: ${report.preciseLocation.uncertaintyMetres} m` : null;
  const observationDateMissing = !report.observedAt;
  const displayedResponse = savedResponse || (restoredDecision ? responseLabels[restoredDecision.responseType] : "");
  const displayedResponseNote = savedResponse ? responseNote : restoredDecision?.notes?.trim() || responseNote;
  const interventionDecisionRecorded = (restoredDecision?.responseType ?? responseType) === "intervention_required";
  const canOpenClosure = Boolean(restoredDecision) && [
    "monitoring",
    "referred",
    "response_recommended",
    "response_planned",
    "response_complete",
  ].includes(currentStatus);
  const triage = report.triageContext;
  const priorityReasons = triage?.priorityReasons ?? [];
  const informationExchange = report.informationExchange;
  const structuredAiItems = aiStructuredItems(report.aiAssisted?.suggestions);
  const threatAiItem = findAiItem(structuredAiItems, ["possible_threat", "threat_type", "threat"]);
  const depthAiItem = findAiItem(structuredAiItems, ["estimated_depth", "estimated_depth_metres"]);
  const embeddedAiItemKeys = new Set([threatAiItem?.key, depthAiItem?.key].filter((key): key is string => Boolean(key)));
  const additionalAiItems = structuredAiItems.filter((item) => !embeddedAiItemKeys.has(item.key));
  const displayedThreat = threatAiItem
    ? (/^[a-z0-9_-]+$/i.test(threatAiItem.value) ? formatFieldName(threatAiItem.value) : threatAiItem.value)
    : report.threat;
  const displayedDepth = depthAiItem
    ? (/^-?\d+(\.\d+)?$/.test(depthAiItem.value.trim()) ? `${depthAiItem.value} m` : depthAiItem.value)
    : report.estimatedDepthMetres == null ? "Not provided" : `${report.estimatedDepthMetres} m`;
  const observerEvidence = report.evidence.filter((item) => !actionEvidenceIds.includes(item.evidenceId));

  if (activeStage === "detail") return <section className={styles.page}>
    <Link className={styles.backLink} href="/coordinator/my-cases">← Back to My Cases</Link>
    <Heading eyebrow={`My Cases / ${report.reportReference}`} title="Review reef observation" description="Review the submitted evidence, observation details and protected location before making a decision." />
    <span className={styles.ownerChip}>Owned by {report.owner.displayName}</span>
    <HotspotCaseContext reportReference={report.reportReference} />
    {claimConfirmation && <div className={styles.successBox} role="status"><strong>{claimConfirmation.statusLabel}: report assigned successfully</strong><p>Claimed at {displayDateTime(claimConfirmation.claimedAt)}. You can now begin reviewing its evidence.</p></div>}
    {triage && <section className={styles.triageContext} aria-labelledby="triage-context-heading"><div><p className={styles.eyebrow}>Transparent triage cues</p><h2 id="triage-context-heading">Priority: {formatFieldName(triage.priority ?? "not set")}</h2><p>{formatFieldName(triage.evidenceCompleteness ?? "not assessed")} evidence · {triage.evidenceCount ?? report.evidence.length} file{(triage.evidenceCount ?? report.evidence.length) === 1 ? "" : "s"} · {triage.hoursInQueue == null ? "Queue age unavailable" : `${Math.round(triage.hoursInQueue)} hours in queue`}</p></div>{priorityReasons.length > 0 && <div><strong>Rules that contributed</strong><ul>{priorityReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<p className={styles.triageDisclaimer}>Priority helps order review. It does not verify the report or make a conservation decision.</p></section>}
    {informationExchange && informationExchange.length > 0 && <section className={styles.informationExchange} aria-labelledby="information-exchange-heading"><h2 id="information-exchange-heading">Information request and response</h2>{informationExchange.map((entry, index) => <div key={`${entry.eventType}-${entry.occurredAt}-${index}`}><strong>{informationExchangeLabel(entry.eventType)}</strong>{entry.message && <p>{entry.message}</p>}<small>{entry.actorDisplayName ? `${entry.actorDisplayName} · ` : ""}{displayDateTime(entry.occurredAt)}</small></div>)}</section>}
    <div className={styles.reviewGrid}><section className={styles.card}>
      <h2>Submitted evidence</h2><p className={styles.muted}>Evidence provided by the observer with this report.</p><EvidenceRecords reportReference={report.reportReference} evidence={observerEvidence} />
      <dl className={styles.detailList}>
        <div><dt>Threat type{threatAiItem && <AiProvenanceIndicator item={threatAiItem} />}</dt><dd>{displayedThreat}</dd></div>
        <div><dt>Observed</dt><dd>{observationDateMissing ? "Unavailable" : displayDateTime(report.observedAt)}</dd></div>
        <div><dt>Estimated depth{depthAiItem && <AiProvenanceIndicator item={depthAiItem} />}</dt><dd>{displayedDepth}</dd></div>
        {additionalAiItems.map((item) => <div key={item.key}><dt>{item.label}<AiProvenanceIndicator item={item} /></dt><dd>{item.value}</dd></div>)}
        <div><dt>Description</dt><dd>{report.description}</dd></div>
        <div><dt>General area</dt><dd>{report.area ?? "Not provided"}</dd></div>
        <div><dt>Submitted</dt><dd>{displayDateTime(report.submittedAt)}</dd></div>
      </dl>
      {structuredAiItems.length > 0 && <p className={styles.inlineAiDisclaimer}>AI-assisted values were reviewed by the Observer before submission. They do not independently verify that the reported threat is present and are not Coordinator-confirmed findings.</p>}
      {observationDateMissing && <div className={styles.warningBox} role="status"><strong>Observation date could not be loaded</strong><p>The observation date is temporarily unavailable. Refresh the case and try again. If it remains unavailable, report the problem to your system administrator.</p></div>}
      <div className={styles.protectedBox}><strong>Submitted location</strong><p>{exactLocation}</p>{report.preciseLocation?.confidenceLabel && <small>Confidence: {report.preciseLocation.confidenceLabel}</small>}{report.preciseLocation?.sourceLabel && <small>Source: {report.preciseLocation.sourceLabel}</small>}{uncertainty && <small>{uncertainty}</small>}{report.preciseLocation?.relocationNotes && <div className={styles.surfaceContext}><strong>Surface entry and exit context</strong><p>{report.preciseLocation.relocationNotes}</p><small>Context only — not an exact underwater location.</small></div>}</div>
    </section><div className={styles.caseSidebar}>
      <aside className={styles.sidePanel}><h2>Case control</h2><dl className={styles.detailList}><div><dt>Active owner</dt><dd>{report.owner.displayName}</dd></div><div><dt>Status</dt><dd>{report.statusLabel}</dd></div></dl><div className={styles.infoBox}><strong>Review type</strong><p>Your assessment is a desk review, not an on-site confirmation.</p></div>{assessmentError && <p className={styles.errorText} role="alert">{assessmentError}</p>}<button className={styles.primaryButton} type="button" onClick={beginAssessment} disabled={pendingAction !== null || !["claimed", "under_review", "evidence_accepted"].includes(currentStatus)}>{pendingAction === "start-review" ? "Starting review…" : currentStatus === "evidence_accepted" ? "Continue to response" : "Start evidence assessment"}</button>{canOpenClosure && <><button className={styles.secondaryButton} type="button" onClick={openClosure} disabled={pendingAction !== null}>Close case</button><p className={styles.muted}>Choose a closure reason and note before the case is closed.</p></>}</aside>
    </div></div>
    {interventionDecisionRecorded && <ConservationActionPanel reportReference={report.reportReference} onEvidenceIdsChange={handleActionEvidenceIds} />}
  </section>;

  if (activeStage === "assess") return <section className={styles.page}>
    <Heading eyebrow="My Cases / Evidence review" title="Assess the submitted evidence" description="Review whether the evidence is usable and plausibly supports the reported threat." />
    <form className={styles.reviewGrid} onSubmit={saveAssessment}><section className={styles.card}><h2>Report {report.reportReference}</h2>
      <fieldset className={styles.radioGroup}><legend>1. Is the evidence usable?</legend><label><input type="radio" name="usable" checked={usable === "yes"} onChange={() => setUsable("yes")} />Yes — the evidence can be assessed</label><label><input type="radio" name="usable" checked={usable === "no"} onChange={() => { setUsable("no"); setCredible(""); }} />No — more information is required</label></fieldset>
      <fieldset className={styles.radioGroup} disabled={usable !== "yes"}><legend>2. Does the evidence plausibly support the reported threat?</legend><label><input type="radio" name="credible" checked={credible === "yes"} onChange={() => setCredible("yes")} />Yes — continue to a response decision</label><label><input type="radio" name="credible" checked={credible === "no"} onChange={() => setCredible("no")} />No — prepare a Not Substantiated closure</label></fieldset>
      <label className={styles.field}>Assessment note <span>Optional — saved with the evidence assessment</span><textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Add any relevant assessment notes" /></label>{assessmentError && <p className={styles.errorText} role="alert">{assessmentError}</p>}<div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStage("detail")} disabled={pendingAction !== null}>Back to case</button><button className={styles.primaryButton} type="submit" disabled={pendingAction !== null}>{pendingAction === "assessment" ? "Saving assessment…" : "Continue"}</button></div>
    </section><aside className={styles.sidePanel}><h2>Assessment guidance</h2><div className={styles.infoBox}><strong>Review only what was submitted</strong><p>Use the photographs and observation details available in this case. Request more information whenever the evidence is unclear.</p></div></aside></form>
  </section>;

  if (activeStage === "request") return <section className={styles.page}>
    <Heading eyebrow="My Cases / Information request" title="Request more information" description="Tell the observer what is missing so the report can continue through review." />
    <form className={styles.reviewGrid} onSubmit={sendRequest}><section className={styles.card}><h2>What information is missing?</h2><div className={styles.checkboxGroup}>{requestChoices.map(([value, label]) => <label key={value}><input type="checkbox" checked={requestItems.includes(value)} onChange={() => toggleRequestItem(value)} />{label}</label>)}</div><label className={styles.field}>Message to the observer *<textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} aria-invalid={Boolean(requestError)} /></label>{requestError && <p className={styles.errorText} role="alert">{requestError}</p>}<div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStage("detail")} disabled={pendingAction !== null}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={pendingAction !== null}>{pendingAction === "request" ? "Sending…" : "Send request"}</button></div></section><aside className={styles.sidePanel}><h2>Case effect</h2><p className={styles.pendingChip}>Needs More Information</p><div className={styles.purpleBox}><strong>Ownership retained</strong><p>{report.owner.displayName} remains the active Case Coordinator.</p></div></aside></form>
  </section>;

  if (activeStage === "request-sent") return <section className={styles.page}><Heading eyebrow={`My Cases / ${report.reportReference}`} title="Information request sent" description="The request was saved and the report remains assigned while the observer response is outstanding." /><section className={`${styles.card} ${styles.resultCard}`}><span className={styles.successIcon} aria-hidden="true">✓</span><h2>More information needed</h2><div className={styles.infoBox}><strong>Message to observer</strong><p>{requestMessage}</p></div><div className={styles.actions}><Link className={styles.secondaryButton} href="/coordinator/report-queue">Return to queue</Link><button className={styles.primaryButton} type="button" onClick={returnToDetail} disabled={pendingAction !== null}>{pendingAction === "refresh" ? "Refreshing…" : "Refresh assigned case"}</button></div></section></section>;

  if (activeStage === "response") return <section className={styles.page}>
    <Heading eyebrow="My Cases / Case decision" title="Choose the next response" description="Select the most appropriate next step after completing the desk review." />
    <form className={styles.reviewGrid} onSubmit={saveResponse}><section className={styles.card}><h2>Report {report.reportReference}</h2><p className={styles.muted}>{report.threat} — {report.area ?? "Location not provided"}</p><fieldset className={styles.optionCards}><legend className="sr-only">Response type</legend><label><input type="radio" name="response" checked={responseType === "monitoring_only"} onChange={() => setResponseType("monitoring_only")} /><span><strong>Monitoring Only</strong><small>Record monitoring without promising intervention.</small></span></label><label><input type="radio" name="response" checked={responseType === "refer_or_share"} onChange={() => setResponseType("refer_or_share")} /><span><strong>Refer / Share for Possible Response</strong><small>Choose a contact before the decision is saved.</small></span></label><label><input type="radio" name="response" checked={responseType === "intervention_required"} onChange={() => setResponseType("intervention_required")} /><span><strong>Intervention Required</strong><small>Record a recommendation, not a guarantee.</small></span></label></fieldset><label className={styles.field}>Decision note <span>Optional</span><textarea value={responseNote} onChange={(event) => setResponseNote(event.target.value)} /></label>{responseError && <p className={styles.errorText} role="alert">{responseError}</p>}<div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStage("assess")} disabled={pendingAction !== null}>Back to assessment</button><button className={styles.primaryButton} type="submit" disabled={pendingAction !== null}>{pendingAction === "decision" ? "Recording…" : "Record response"}</button></div></section><aside className={styles.sidePanel}><h2>Honest status language</h2><div className={styles.warningBox}><strong>Referral</strong><p>Shared for consideration does not mean accepted.</p></div><div className={styles.infoBox}><strong>Monitoring</strong><p>Monitoring Recommended records the coordinator decision.</p></div></aside></form>
  </section>;

  if (activeStage === "response-saved") return <section className={styles.page}><Heading eyebrow={`My Cases / ${report.reportReference}`} title="Response decision recorded" description="The recommendation was saved without promising completed conservation action." /><section className={`${styles.card} ${styles.resultCard}`}><span className={styles.successIcon} aria-hidden="true">✓</span><h2>{displayedResponse}</h2><p>{displayedResponseNote}</p>{responseError && <p className={styles.errorText} role="alert">{responseError}</p>}<div className={styles.warningBox}><strong>Case remains open by default</strong><p>A recommendation is not the same as confirmed action. Close only when a valid outcome applies.</p></div><div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={returnToDetail} disabled={pendingAction !== null}>{pendingAction === "refresh" ? "Refreshing…" : "Keep case open"}</button><button className={styles.primaryButton} type="button" onClick={openClosure}>Record a closure outcome</button></div></section>{interventionDecisionRecorded && <ConservationActionPanel reportReference={report.reportReference} onEvidenceIdsChange={handleActionEvidenceIds} />}</section>;

  if (activeStage === "referral") return <section className={styles.page}><Heading eyebrow="My Cases / Referral" title="Share for possible response" description="Record the recipient and sharing note before saving the referral decision." /><form className={styles.card} onSubmit={confirmReferral}><h2>Sharing summary</h2><p className={styles.muted}>Report {report.reportReference} — {report.threat} — {report.area ?? "Location not provided"}</p><div className={styles.referralGrid}><label className={styles.field}>Recipient organisation or contact *<input type="text" value={responder} onChange={(event) => setResponder(event.target.value)} maxLength={255} placeholder="For example, Tioman Marine Park Department" aria-invalid={Boolean(referralError)} /></label><aside className={styles.warningBox}><strong>Sharing status</strong><p>The observer sees that the case was shared, not that action is guaranteed.</p></aside><label className={`${styles.field} ${styles.fullWidth}`}>Sharing note *<textarea value={referralNote} onChange={(event) => setReferralNote(event.target.value)} /></label></div>{referralError && <p className={styles.errorText} role="alert">{referralError}</p>}<div className={styles.splitActions}><button className={styles.secondaryButton} type="button" onClick={closeWithoutPartner} disabled={pendingAction !== null}>{pendingAction === "referral" ? "Recording…" : "No partner available"}</button><button className={styles.primaryButton} type="submit" disabled={pendingAction !== null}>{pendingAction === "referral" ? "Recording…" : "Record referral"}</button></div></form></section>;

  if (activeStage === "close") return <section className={styles.page}><Heading eyebrow="My Cases / Close report" title="Choose a closure reason" description="All five Iteration 1 reasons are shown. Reasons that conflict with the recorded response remain unavailable." /><form className={styles.reviewGrid} onSubmit={submitClosure}><section className={styles.card}><fieldset className={styles.closureList}><legend>Select one closure reason</legend>{closureReasons.map((item) => { const available = allowedClosures.some((allowed) => allowed.value === item.value); return <label key={item.value}><input type="radio" name="closure" checked={closureReason === item.value} disabled={!available} onChange={() => { setClosureReason(item.value); setClosureError(""); }} /><span><strong>{item.label}</strong><small>{item.observer}</small>{!available && <small>Not available for the recorded response decision</small>}</span></label>; })}</fieldset><label className={styles.field}>Public closure note *<textarea value={closureNote} onChange={(event) => setClosureNote(event.target.value)} aria-invalid={Boolean(closureError)} /></label>{closureError && <p className={styles.errorText} role="alert">{closureError}</p>}</section><aside className={styles.sidePanel}><h2>Before closing</h2><ul className={styles.checkList}><li>One compatible reason selected</li><li>Observer-safe explanation recorded</li><li>Your name and completion time will be recorded</li></ul><div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStage(reviewOutcome === "not_substantiated" ? "assess" : reviewOutcome === "referral" ? "referral" : "response-saved")} disabled={pendingAction !== null}>Back</button><button className={styles.dangerButton} type="submit" disabled={pendingAction !== null}>{pendingAction === "closure" ? "Closing…" : "Close case"}</button></div></aside></form></section>;

  return <section className={styles.page}><Heading eyebrow={`My Cases / ${report.reportReference}`} title="Case outcome recorded" description="The closure reason, public note and time were saved." /><section className={`${styles.card} ${styles.resultCard}`}><span className={styles.successIcon} aria-hidden="true">✓</span><h2>{closure?.label ?? "Case closed"}</h2><p>Report {report.reportReference} now has a traceable outcome.</p><div className={styles.infoBox}><strong>Message shown to observer</strong><p>{closureNote}</p></div><div className={styles.actions}><Link className={styles.primaryButton} href="/coordinator/report-queue">Return to queue</Link></div></section></section>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReviewLocationSummary } from "@/features/epic-04-location/location-flow";
import { useMockAppState } from "@/features/shared/mock-app-state";
import { isFutureDisplayDateTime, isValidDisplayDate } from "@/lib/format/date";
import { reviewReport, submitReport as submitReportApi } from "@/lib/api/reportsApi";
import { getThreatCategories } from "@/lib/api/referenceApi";
import type { ReportReviewResponse, ThreatCategoryReference } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { clearDraftPhotos, loadDraftPhotos, type StoredDraftPhoto } from "./draft-storage";
import { getThreatCategory } from "./threat-data";
import { buildReportReviewPayload, buildReportSubmissionPayload } from "./report-payload";
import { applySuggestionValue, suggestionStateLabel } from "./smart-report-state";
import styles from "./reporting.module.css";
import { formatCompletenessItem } from "./completeness-display";
import { saveSubmittedStructuredDetails } from "./submitted-structured-details";

type ReviewPhoto = StoredDraftPhoto & { previewUrl: string };

export function ReportReview() {
  const router = useRouter();
  const { reportDraft, locationDraft, updateReportDraft, resetReportDraft } = useMockAppState();
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const submissionInProgress = useRef(false);
  const [submissionError, setSubmissionError] = useState("");
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [backendReview, setBackendReview] = useState<ReportReviewResponse | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewing, setReviewing] = useState(true);
  const [categoryReferences, setCategoryReferences] = useState<ThreatCategoryReference[]>([]);
  const [editingSuggestion, setEditingSuggestion] = useState<number | null>(null);
  const [editedSuggestionValue, setEditedSuggestionValue] = useState("");
  const threat = getThreatCategory(reportDraft.threatCategoryCode);
  const session = locationDraft.sessions.find((item) => item.id === locationDraft.selectedSessionId);

  useEffect(() => {
    let cancelled = false;
    getThreatCategories()
      .then((categories) => { if (!cancelled) setCategoryReferences(categories); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const createdPreviewUrls: string[] = [];
    loadDraftPhotos()
      .then((stored) => {
        if (cancelled) return;
        const restored = stored.map((photo) => {
          const previewUrl = URL.createObjectURL(photo.file);
          createdPreviewUrls.push(previewUrl);
          return { ...photo, previewUrl };
        });
        setPhotos(restored);
        setPhotosLoaded(true);
      })
      .catch(() => { setPhotoLoadFailed(true); setPhotosLoaded(true); });
    return () => {
      cancelled = true;
      createdPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!photosLoaded) return;
    let cancelled = false;
    reviewReport(buildReportReviewPayload(reportDraft, locationDraft, photos.length))
      .then((result) => { if (!cancelled) setBackendReview(result); })
      .catch((error) => {
        if (!cancelled) {
          setBackendReview(null);
          setReviewError(userFacingError(error, "Server review is temporarily unavailable. Check the visible details before submitting."));
        }
      })
      .finally(() => { if (!cancelled) setReviewing(false); });
    return () => { cancelled = true; };
  }, [locationDraft, photos.length, photosLoaded, reportDraft]);

  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (photos.length === 0) items.push("at least one photograph");
    if (!threat || !reportDraft.threatCategoryId) items.push("threat category");
    if (!reportDraft.observationDate || !isValidDisplayDate(reportDraft.observationDate)) items.push("valid observation date");
    if (!reportDraft.observationTime) items.push("observation time");
    else if (isFutureDisplayDateTime(reportDraft.observationDate, reportDraft.observationTime)) items.push("observation date and time that are not in the future");
    if (!reportDraft.description.trim()) items.push("description");
    if (!session?.backendId || !locationDraft.confidence) items.push("Dive Session, location and confidence");
    return items;
  }, [locationDraft.confidence, photos.length, reportDraft, session, threat]);
  const unresolvedSuggestions = backendReview?.unresolvedSuggestions ?? (reportDraft.aiSuggestions ?? []).filter((suggestion) => suggestion.status === "unresolved");
  const backendBlocking = backendReview ? !backendReview.isSubmittable : false;
  const canSubmit = missingItems.length === 0 && unresolvedSuggestions.length === 0 && !backendBlocking && !reviewing;

  function resolveSuggestion(index: number, action: "accept" | "keep" | "remove" | "unsure") {
    const suggestion = reportDraft.aiSuggestions[index];
    if (!suggestion) return;
    const nextSuggestions = reportDraft.aiSuggestions.map((item, suggestionIndex) => {
      if (suggestionIndex !== index) return item;
      if (action === "remove") return { ...item, status: "removed" as const, conflict: false };
      if (action === "keep") return {
        ...item,
        suggestedValue: item.observerValue,
        status: "corrected" as const,
        conflict: false,
      };
      if (action === "unsure") return {
        ...item,
        suggestedValue: "Unsure",
        status: "corrected" as const,
        conflict: false,
        observerValue: "Unsure",
      };
      return { ...item, status: "confirmed" as const, conflict: false };
    });
    const fieldChanges = action === "accept"
      ? applySuggestionValue(reportDraft, suggestion, categoryReferences)
      : action === "unsure" && suggestion.field === "possible_threat"
        ? {
            threatCategoryCode: "unsure" as const,
            threatCategoryId: categoryReferences.find((category) => category.code === "unsure")?.threatCategoryId ?? 5,
          }
        : {};
    updateReportDraft({ ...fieldChanges, aiSuggestions: nextSuggestions });
  }

  function acceptAllNonConflicting() {
    let nextReport = { ...reportDraft, aiSuggestions: reportDraft.aiSuggestions.map((item) => ({ ...item })) };
    nextReport.aiSuggestions.forEach((suggestion, index) => {
      if (suggestion.status !== "unresolved" || suggestion.conflict) return;
      nextReport = { ...nextReport, ...applySuggestionValue(nextReport, suggestion, categoryReferences) };
      nextReport.aiSuggestions[index] = { ...suggestion, status: "confirmed", conflict: false };
    });
    updateReportDraft(nextReport);
  }

  function beginEditingSuggestion(index: number) {
    setEditingSuggestion(index);
    setEditedSuggestionValue(reportDraft.aiSuggestions[index]?.suggestedValue ?? "");
  }

  function saveEditedSuggestion(index: number) {
    const suggestion = reportDraft.aiSuggestions[index];
    if (!suggestion) return;
    const value = editedSuggestionValue.trim();
    const updatedSuggestion = {
      ...suggestion,
      suggestedValue: value || null,
      observerValue: value || null,
      status: value ? "corrected" as const : "removed" as const,
      conflict: false,
    };
    const fieldChanges = value ? applySuggestionValue(reportDraft, updatedSuggestion, categoryReferences) : {};
    updateReportDraft({
      ...fieldChanges,
      aiSuggestions: reportDraft.aiSuggestions.map((item, itemIndex) => itemIndex === index ? updatedSuggestion : item),
    });
    setEditingSuggestion(null);
    setEditedSuggestionValue("");
  }

  async function submit() {
    if (!canSubmit || submissionInProgress.current) return;
    submissionInProgress.current = true;
    setSubmitting(true);
    setSubmissionError("");
    try {
      const payload = buildReportSubmissionPayload(reportDraft, locationDraft);
      const result = await submitReportApi(payload, photos.map((photo) => photo.file));
      saveSubmittedStructuredDetails(result.reportReference, reportDraft);
      const query = new URLSearchParams({
        reportReference: result.reportReference,
        status: result.status,
        submittedAt: result.submittedAt,
        generalLocation: result.generalLocation,
        threatCategory: threat?.label ?? "Not provided",
      });
      const destination = `/report-a-reef/confirmation?${query.toString()}`;
      setConfirmationUrl(destination);
      // A local cleanup failure cannot undo a successful server submission.
      await clearDraftPhotos().catch(() => undefined);
      resetReportDraft();
      router.push(destination);
    } catch (error) {
      setSubmissionError(userFacingError(error, "The report could not be submitted."));
      setSubmitting(false);
      submissionInProgress.current = false;
    }
  }

  if (confirmationUrl) {
    return <section className={styles.card}>
      <div role="status"><h2>Report submitted</h2><p>Opening your confirmation…</p></div>
      <Link className={styles.primaryButton} href={confirmationUrl}>View confirmation</Link>
    </section>;
  }

  return (
    <div className={styles.stack}>
      {missingItems.length > 0 && <section className={styles.errorBox} role="alert"><strong>Complete the report before submitting</strong><p>Missing: {missingItems.join(", ")}.</p><Link className={styles.textButton} href="/report-a-reef">Return to observation details</Link></section>}
      {photoLoadFailed && <section className={styles.errorBox}><strong>Photographs could not be restored</strong><p>Return to the observation form and select the evidence again.</p></section>}
      {submissionError && <section className={styles.errorBox} role="alert"><strong>Report not submitted</strong><p>{submissionError}</p></section>}
      {reviewing && <section className={styles.infoBox} role="status"><strong>Checking report completeness…</strong><p>Required fields, suggestions and location guidance are being checked.</p></section>}
      {reviewError && <section className={styles.errorBox} role="alert"><strong>Server review unavailable</strong><p>{reviewError}</p></section>}
      {unresolvedSuggestions.length > 0 && <section className={styles.warningBox} role="status"><strong>AI-assisted details need your review</strong><p>Resolve the highlighted fields below before submitting.</p></section>}
      {backendReview?.locationWarning?.hasWarning && <section className={styles.warningBox} role="status"><strong>Location guidance</strong><p>{backendReview.locationWarning.message}</p><small>This warning does not block submission.</small></section>}

      <div className={styles.reviewLayout}>
        <div className={styles.reviewMain}>
          <section className={styles.card}>
            <div className={styles.sectionHeader}><div><h2>Observation summary</h2><p>This is the information that will be lodged with ReefCare MY.</p></div><Link className={styles.textButton} href="/report-a-reef">Edit observation</Link></div>
            {photos.length > 0 && <div className={styles.reviewPhotos}>{photos.map((photo) => <article className={styles.reviewPhoto} key={photo.id}><Image className={styles.photoImage} src={photo.previewUrl} alt={`Evidence preview: ${photo.file.name}`} width={520} height={320} unoptimized /><p title={photo.file.name}>{photo.file.name}</p></article>)}</div>}
            <dl className={styles.summaryList}>
              <div><dt>Possible threat type</dt><dd>{threat?.label ?? "Not provided"}</dd></div>
              <div><dt>Observed</dt><dd>{reportDraft.observationDate && reportDraft.observationTime ? `${reportDraft.observationDate}, ${reportDraft.observationTime}` : "Not provided"}</dd></div>
              <div><dt>Estimated depth</dt><dd>{reportDraft.estimatedDepthMetres ? `${reportDraft.estimatedDepthMetres} m` : "Not provided"}</dd></div>
              <div><dt>Photographs</dt><dd>{photos.length || "Not provided"}</dd></div>
              <div className={styles.fullWidth}><dt>Description</dt><dd className={styles.description}>{reportDraft.description.trim() || "Not provided"}</dd></div>
            </dl>
            {(reportDraft.aiSuggestions ?? []).length > 0 && <section className={styles.reviewSuggestions} aria-labelledby="ai-review-heading">
              <div className={styles.reviewSuggestionHeader}><div><h3 id="ai-review-heading">Review AI-assisted information</h3><p>{unresolvedSuggestions.length} field{unresolvedSuggestions.length === 1 ? "" : "s"} still need your review.</p></div>{reportDraft.aiSuggestions.some((item) => item.status === "unresolved" && !item.conflict) && <button className={styles.secondaryButton} type="button" onClick={acceptAllNonConflicting}>Accept AI suggestions</button>}</div>
              {reportDraft.aiSuggestions.map((suggestion, index) => <article className={`${styles.reviewSuggestionItem} ${suggestion.conflict && suggestion.status === "unresolved" ? styles.reviewConflict : ""}`} key={`${suggestion.field}-${index}`}>
                <div><span>{suggestion.label}</span><em>{suggestionStateLabel(suggestion)}</em></div>
                {editingSuggestion === index ? <div className={styles.suggestionEditor}>
                  {suggestion.field === "possible_threat" ? <select aria-label={`Edit ${suggestion.label}`} value={editedSuggestionValue} onChange={(event) => setEditedSuggestionValue(event.target.value)}><option value="">Not included</option>{categoryReferences.map((category) => <option key={category.code} value={category.label}>{category.label}</option>)}</select> : <input aria-label={`Edit ${suggestion.label}`} value={editedSuggestionValue} onChange={(event) => setEditedSuggestionValue(event.target.value)} placeholder="Not included" />}
                  <button className={styles.smallButton} type="button" onClick={() => saveEditedSuggestion(index)}>Save</button>
                  <button className={styles.smallButton} type="button" onClick={() => setEditingSuggestion(null)}>Cancel</button>
                </div> : <strong>{suggestion.status === "removed" ? "Not included" : suggestion.suggestedValue || "Not included"}</strong>}
                {suggestion.conflict && suggestion.status === "unresolved" && <p>Your report currently says <strong>{suggestion.observerValue}</strong>. Choose which value should be used.</p>}
                {editingSuggestion !== index && <div className={styles.compactActions}>
                  {suggestion.status === "unresolved" && <>
                  <button className={styles.smallButton} type="button" onClick={() => resolveSuggestion(index, "accept")}>Use AI suggestion</button>
                  {suggestion.conflict && <button className={styles.smallButton} type="button" onClick={() => resolveSuggestion(index, "keep")}>Keep my value</button>}
                  {suggestion.field === "possible_threat" && <button className={styles.smallButton} type="button" onClick={() => resolveSuggestion(index, "unsure")}>Keep Unsure</button>}
                  </>}
                  <button className={styles.smallButton} type="button" onClick={() => beginEditingSuggestion(index)}>Edit</button>
                </div>}
              </article>)}
            </section>}
          </section>
          <ReviewLocationSummary />
        </div>

        <aside className={styles.sideCard}>
          <h2>Before submitting</h2>
          {backendReview && <div className={backendReview.completeness.isSubmittable ? styles.successBox : styles.errorBox}><strong>{backendReview.completeness.summary}</strong>{backendReview.completeness.blockingMissing.length > 0 && <p>Required: {backendReview.completeness.blockingMissing.map(formatCompletenessItem).join(", ")}.</p>}{backendReview.completeness.blockingIssues.length > 0 && <p>Fix: {backendReview.completeness.blockingIssues.map(formatCompletenessItem).join(", ")}.</p>}{backendReview.completeness.recommendedMissing.length > 0 && <p>Recommended: {backendReview.completeness.recommendedMissing.map(formatCompletenessItem).join(", ")}.</p>}</div>}
          <ul className={styles.checkList}><li>The details describe what you observed</li><li>No scientific diagnosis is required</li><li>Exact coordinates remain protected</li><li>Submission creates a traceable report</li></ul>
          <div className={styles.infoBox}><strong>Initial status: Received</strong><p>Submission places the report in the Case Coordinator queue. Claiming and evidence decisions occur later.</p></div>
          <button className={styles.primaryButton} type="button" disabled={!canSubmit || submitting} onClick={submit}>{submitting ? "Submitting…" : reviewing ? "Checking…" : "Submit report"}</button>
        </aside>
      </div>
    </div>
  );
}

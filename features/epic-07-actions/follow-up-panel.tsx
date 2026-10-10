"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { getConservationActionTypes, getCoordinatorEvidence } from "@/lib/api/coordinatorApi";
import {
  correctFollowUp, createFollowUp, createMonitoring, getFollowUps, getMonitoringConditions, setFollowUpPublication, uploadFollowUpEvidence,
} from "@/lib/api/iteration3Api";
import type { ConservationActionTypeOption } from "@/lib/api/types";
import type { FollowUp, FollowUpCorrection, MonitoringCondition } from "@/lib/api/iteration3-types";
import { displayDateToIsoDate, isFutureDisplayDate, isValidDisplayDate } from "@/lib/format/date";
import { userFacingError } from "@/lib/api/user-facing-error";
import { ApiError } from "@/lib/api/client";
import styles from "./follow-up-panel.module.css";

type Mode = "action" | "monitoring" | "sourced_outcome";
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 10 * 1024 * 1024;
const dateLabel = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Not recorded";
const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());

function publicationEligible(record: FollowUp) {
  return record.isDemonstration === false && !record.supersededByCaseActionId && Boolean(record.recordedOutcome?.trim())
    && (record.followUpType === "action" && record.followUpState === "action_taken"
      || record.followUpType === "sourced_outcome" && record.followUpState === "outcome_recorded");
}

function EvidencePreview({ reportReference, evidenceId }: { reportReference: string; evidenceId: number }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    getCoordinatorEvidence(reportReference, evidenceId).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [reportReference, evidenceId]);
  return failed ? <span>Image unavailable</span>
    : url ? <Image src={url} width={180} height={120} unoptimized alt="Supporting follow-up evidence" />
      : <span>Loading image…</span>;
}

export function FollowUpPanel({
  reportReference, statusCode, responseType, onEvidenceIdsChange,
}: {
  reportReference: string;
  statusCode: string;
  responseType?: string | null;
  onEvidenceIdsChange?: (ids: number[]) => void;
}) {
  const [records, setRecords] = useState<FollowUp[]>([]);
  const [emptyMessage, setEmptyMessage] = useState("");
  const [conditions, setConditions] = useState<MonitoringCondition[]>([]);
  const [actionTypes, setActionTypes] = useState<ConservationActionTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [publicationTarget, setPublicationTarget] = useState<{ id: number; publish: boolean } | null>(null);
  const [publicationError, setPublicationError] = useState("");
  const [publicationNotice, setPublicationNotice] = useState("");
  const publicationBusy = useRef(false);
  const [mode, setMode] = useState<Mode>("monitoring");
  const [actionState, setActionState] = useState<"action_planned" | "action_taken">("action_planned");
  const [actionTypeCode, setActionTypeCode] = useState("");
  const [date, setDate] = useState("");
  const [team, setTeam] = useState("");
  const [recordingLevel, setRecordingLevel] = useState<"coordinator_summary" | "responder_record" | "externally_sourced">("coordinator_summary");
  const [outcome, setOutcome] = useState("");
  const [source, setSource] = useState("");
  const [observations, setObservations] = useState("");
  const [conditionCode, setConditionCode] = useState("");
  const [nextRequired, setNextRequired] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ caseActionId: number; file: File } | null>(null);
  const [correctionId, setCorrectionId] = useState<number | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctedTeam, setCorrectedTeam] = useState("");
  const [correctedOutcome, setCorrectedOutcome] = useState("");
  const [correctedState, setCorrectedState] = useState<"action_planned" | "action_taken" | "outcome_recorded">("action_planned");
  const [correctedDate, setCorrectedDate] = useState("");
  const [correctedNotes, setCorrectedNotes] = useState("");

  const reload = useCallback(async () => {
    const list = await getFollowUps(reportReference);
    setRecords(list.items);
    setEmptyMessage(list.message);
  }, [reportReference]);

  async function savePublication() {
    if (!publicationTarget || saving || publicationBusy.current || pendingPhoto) return;
    const current = records.find((record) => record.caseActionId === publicationTarget.id);
    if (!current || current.isDemonstration !== false || current.supersededByCaseActionId || typeof current.isPublishable !== "boolean"
      || (publicationTarget.publish && !publicationEligible(current))) return;
    publicationBusy.current = true;
    setSaving(true); setPublicationError(""); setPublicationNotice("");
    try {
      const saved = await setFollowUpPublication(reportReference, current.caseActionId, publicationTarget.publish);
      // Publication appends a new version. Use its new ID for future operations.
      setRecords((items) => [...items.filter((item) => item.caseActionId !== current.caseActionId
        && item.caseActionId !== saved.caseActionId && item.caseActionId !== saved.supersedesCaseActionId), saved]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setPublicationTarget(null);
      setPublicationNotice(saved.isPublishable
        ? "This follow-up is published in public site activity."
        : "This follow-up was withdrawn from public site activity. Its internal history remains available.");
    } catch (requestError) {
      if (requestError instanceof ApiError && (requestError.status === 409 || requestError.status === 404)) {
        setPublicationTarget(null);
        setPublicationError("This follow-up has changed. Refreshing its latest history…");
        try {
          await reload();
          setPublicationError("This follow-up has changed. The history has been refreshed; review the latest record before publishing or withdrawing it.");
        }
        catch { setPublicationError("This follow-up has changed, but its latest history could not be loaded. Refresh the case before trying again."); }
      } else setPublicationError(userFacingError(requestError, "The publication change could not be saved. Check the current history before trying again."));
    } finally { publicationBusy.current = false; setSaving(false); }
  }
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getFollowUps(reportReference), getMonitoringConditions(), getConservationActionTypes()])
      .then(([listResult, conditionResult, typeResult]) => {
        if (cancelled) return;
        if (listResult.status === "fulfilled") {
          setRecords(listResult.value.items); setEmptyMessage(listResult.value.message);
        } else setLoadError(userFacingError(listResult.reason, "Follow-up records could not be loaded."));
        if (conditionResult.status === "fulfilled") {
          setConditions(conditionResult.value);
          setConditionCode((current) => current || conditionResult.value[0]?.code || "");
        }
        if (typeResult.status === "fulfilled") {
          setActionTypes(typeResult.value);
          setActionTypeCode((current) => current || typeResult.value[0]?.code || "");
        }
        if (conditionResult.status === "rejected" || typeResult.status === "rejected") {
          setReferenceError("Some form options could not be loaded. Refresh this case before recording a follow-up.");
        }
      }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reportReference]);
  useEffect(() => {
    onEvidenceIdsChange?.(records.flatMap((record) => record.evidence?.map((evidence) => evidence.evidenceId) ?? []));
  }, [records, onEvidenceIdsChange]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setError("");
    if (file && (!allowedImageTypes.includes(file.type) || file.size === 0 || file.size > maxImageSize)) {
      setError("Choose a JPG, PNG or WebP image that is no larger than 10 MB.");
      setPhoto(null); return;
    }
    setPhoto(file);
  }

  async function attachPhoto(caseActionId: number, file: File) {
    const evidence = await uploadFollowUpEvidence(reportReference, caseActionId, file);
    // An accepted upload must not be retried just because refreshing history failed.
    setPendingPhoto(null);
    setRecords((items) => items.map((record) => record.caseActionId === caseActionId
      ? { ...record, evidence: [...(record.evidence ?? []).filter((item) => item.evidenceId !== evidence.evidenceId), evidence] }
      : record));
    try { await reload(); }
    catch { setError("The photo was attached, but the latest history could not be loaded. Refresh the case to check it."); }
  }

  async function retryPhoto() {
    if (!pendingPhoto || saving) return;
    setSaving(true); setError("");
    try { await attachPhoto(pendingPhoto.caseActionId, pendingPhoto.file); setNotice("The evidence photo was attached."); }
    catch (requestError) { setError(userFacingError(requestError, "The photo could not be attached. Try again.")); }
    finally { setSaving(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || publicationBusy.current || pendingPhoto) return;
    setError(""); setNotice(""); setPublicationNotice("");
    if (!date && (mode !== "action" || actionState === "action_taken")) {
      setError("Enter the date of the completed follow-up."); return;
    }
    if (date && (!isValidDisplayDate(date) || (mode !== "action" || actionState === "action_taken") && isFutureDisplayDate(date))) {
      setError("Enter a valid date in dd/mm/yyyy format that is not in the future."); return;
    }
    if (mode === "action" && !actionTypeCode) { setError("Choose an action type."); return; }
    if (mode === "action" && !actionAllowed) { setError("Record a response decision before adding an action."); return; }
    if (mode === "action" && actionState === "action_taken" && !canRecordTaken) {
      setError("Record a planned action before marking it taken."); return;
    }
    if (mode === "sourced_outcome" && (!source.trim() || !outcome.trim())) {
      setError("Enter the source and the outcome that was reported."); return;
    }
    if (mode === "monitoring" && (!conditionCode || !observations.trim())) {
      setError("Choose a reviewed condition and describe what was observed."); return;
    }
    if (mode === "monitoring" && nextRequired && (!nextDate || !isValidDisplayDate(nextDate) || (date && displayDateToIsoDate(nextDate) < displayDateToIsoDate(date)))) {
      setError("Enter a valid next follow-up date on or after this visit."); return;
    }
    setSaving(true);
    try {
      const saved = mode === "monitoring"
        ? await createMonitoring(reportReference, {
          actionDate: displayDateToIsoDate(date), conditionCode, observations: observations.trim(),
          notes: notes.trim() || undefined, nextFollowUpRequired: nextRequired,
          ...(nextRequired ? { nextFollowUpDate: displayDateToIsoDate(nextDate) } : {}),
        })
        : await createFollowUp(reportReference, mode === "action"
          ? {
            followUpType: "action", followUpState: actionState, actionTypeCode, recordingLevel,
            ...(date ? { actionDate: displayDateToIsoDate(date) } : {}),
            responsibleTeam: team.trim() || undefined, recordedOutcome: outcome.trim() || undefined,
            notes: notes.trim() || undefined,
          }
          : {
            followUpType: "sourced_outcome", followUpState: "outcome_recorded", recordingLevel: "externally_sourced",
            actionDate: displayDateToIsoDate(date), sourceReference: source.trim(),
            recordedOutcome: outcome.trim(), responsibleTeam: team.trim() || undefined,
            notes: notes.trim() || undefined,
          });
      // Keep the saved record even if refreshing its list fails. Never create it again for a photo retry.
      setRecords((items) => [...items.filter((item) => item.caseActionId !== saved.caseActionId), saved]);
      setNotice(mode === "action" && actionState === "action_planned"
        ? "The planned action was recorded. It has not been completed."
        : mode === "sourced_outcome" ? "The sourced outcome was recorded."
          : mode === "monitoring" ? "The monitoring visit was recorded." : "The completed action was recorded.");
      if (photo) {
        try { await attachPhoto(saved.caseActionId, photo); }
        catch (requestError) {
          setPendingPhoto({ caseActionId: saved.caseActionId, file: photo });
          setError(userFacingError(requestError, "The record was saved, but its photo could not be attached. Try the upload again."));
        }
      }
      if (!photo) {
        try { await reload(); }
        catch { setError("The follow-up was saved, but the latest history could not be loaded. Refresh the case to check it."); }
      }
      setDate(""); setTeam(""); setOutcome(""); setSource(""); setObservations(""); setNotes(""); setPhoto(null); setNextDate(""); setNextRequired(false);
    } catch (requestError) { setError(userFacingError(requestError, "The follow-up could not be saved.")); }
    finally { setSaving(false); }
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || publicationBusy.current || pendingPhoto) return;
    if (correctionId == null || !correctionReason.trim()) { setError("Explain the correction before saving."); return; }
    const original = records.find((record) => record.caseActionId === correctionId);
    if (!original) return;
    if (correctedDate && !isValidDisplayDate(correctedDate)) { setError("Enter a valid date in dd/mm/yyyy format."); return; }
    if (correctedState === "action_taken" && !correctedDate) { setError("Enter the date the action was taken."); return; }
    if (correctedDate && correctedState !== "action_planned" && isFutureDisplayDate(correctedDate)) {
      setError("A completed follow-up date cannot be in the future."); return;
    }
    const changes: FollowUpCorrection = { correctionReason: correctionReason.trim() };
    if (correctedTeam.trim() !== (original.responsibleTeam ?? "")) changes.responsibleTeam = correctedTeam.trim();
    if (correctedOutcome.trim() !== (original.recordedOutcome ?? "")) changes.recordedOutcome = correctedOutcome.trim();
    if (correctedState !== original.followUpState) changes.followUpState = correctedState;
    if (correctedDate && displayDateToIsoDate(correctedDate) !== original.actionDate) changes.actionDate = displayDateToIsoDate(correctedDate);
    if (correctedNotes.trim() !== (original.notes ?? "")) changes.notes = correctedNotes.trim();
    if (Object.keys(changes).length === 1) { setError("Change at least one field before saving."); return; }
    setSaving(true); setError(""); setPublicationNotice("");
    try {
      await correctFollowUp(reportReference, correctionId, changes);
      await reload(); setCorrectionId(null); setCorrectionReason(""); setNotice("The correction was recorded; the original remains in the audit history. The corrected version is private until published again.");
    } catch (requestError) { setError(userFacingError(requestError, "The correction could not be saved.")); }
    finally { setSaving(false); }
  }

  const assessed = !["draft", "submitted", "received", "claimed", "under_review", "needs_more_info"].includes(statusCode);
  const actionAllowed = responseType === "intervention_required" || ["response_recommended", "response_planned", "response_complete"].includes(statusCode);
  const canRecordTaken = ["response_planned", "response_complete"].includes(statusCode)
    || records.some((record) => record.followUpType === "action" && record.followUpState === "action_planned");
  return <section className={styles.panel} aria-labelledby="follow-up-heading">
    <header><p className={styles.eyebrow}>Conservation record</p><h2 id="follow-up-heading">Follow-up and monitoring</h2>
      <p>Record only work that is planned or has happened. A referral remains a referral until a sourced outcome is recorded.</p></header>
    {loading && <p role="status">Loading follow-up records…</p>}
    {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoading(true); setLoadError(""); reload().catch((requestError) => setLoadError(userFacingError(requestError, "Follow-up records could not be loaded."))).finally(() => setLoading(false)); }}>Try again</button></div>}
    {!loading && !loadError && <>
      <h3>Recorded history</h3>
      {publicationError && <p className={styles.error} role="alert">{publicationError}</p>}
      {publicationNotice && <p className={styles.success} role="status">{publicationNotice}</p>}
      {records.length === 0 ? <p role="status">{emptyMessage || "No follow-up has been recorded for this case."}</p> : <ol className={styles.history}>
        {records.map((record) => <li key={record.caseActionId}>
          <div className={styles.historyHead}><strong>{record.followUpType === "monitoring" ? "Monitoring visit"
            : record.followUpType === "sourced_outcome" ? "Sourced outcome"
              : record.followUpState === "action_planned" ? "Action planned" : "Action taken"}</strong>
            <span>{dateLabel(record.actionDate)} · Recorded {new Date(record.createdAt).toLocaleString("en-MY")}</span></div>
          <p>{record.followUpType === "monitoring" ? `Human-reviewed condition: ${record.conditionLabel ?? readable(record.conditionCode ?? "needs_review")}`
            : record.actionTypeLabel || (record.followUpType === "sourced_outcome" ? "External outcome" : "Conservation action")}</p>
          {record.observations && <p><strong>Observations:</strong> {record.observations}</p>}
          {record.recordedOutcome && <p><strong>Recorded outcome:</strong> {record.recordedOutcome}</p>}
          {record.responsibleTeam && <p><strong>Responsible team:</strong> {record.responsibleTeam}</p>}
          {record.sourceReference && <p><strong>Source:</strong> {record.sourceReference}</p>}
          {record.notes && <p><strong>Notes:</strong> {record.notes}</p>}
          {record.followUpType === "monitoring" && <p>{record.nextFollowUpRequired
            ? `Next follow-up required${record.nextFollowUpDate ? ` by ${dateLabel(record.nextFollowUpDate)}` : ""}.`
            : "No follow-up currently scheduled."}</p>}
          {record.followUpState === "action_planned" && <p className={styles.notice}>This action is planned; completion has not been recorded.</p>}
          <small>Recorded by {record.createdByName || "Coordinator"} · {readable(record.recordingLevel || "coordinator_summary")}</small>
          <div className={styles.publication}>
            <strong>{record.isDemonstration ? "Demonstration record — stays private" : record.isPublishable === true ? "Published in public site activity"
              : record.isPublishable === false ? "Private — not published"
                : "Publication status unavailable"}</strong>
            {(record.followUpType === "monitoring" || record.followUpState === "action_planned")
              ? <p>Planned actions and monitoring visits stay private.</p>
              : !record.recordedOutcome?.trim() && <p>Add a recorded outcome before publishing this follow-up.</p>}
            {(typeof record.isPublishable !== "boolean" || typeof record.isDemonstration !== "boolean") && <p>Refresh this case once publication status is available.</p>}
            {record.isDemonstration === false && !record.supersededByCaseActionId && typeof record.isPublishable === "boolean"
              && (record.isPublishable || publicationEligible(record)) && <button type="button" className={styles.textButton}
                disabled={saving || correctionId != null || pendingPhoto != null} onClick={() => {
                  setPublicationTarget({ id: record.caseActionId, publish: !record.isPublishable });
                  setPublicationError(""); setPublicationNotice("");
                }}>{record.isPublishable ? "Withdraw from public activity" : "Publish to public activity"}</button>}
          </div>
          {(record.evidence?.length ?? 0) > 0 && <div className={styles.photos}>{record.evidence.map((evidence) =>
            <EvidencePreview key={evidence.evidenceId} reportReference={reportReference} evidenceId={evidence.evidenceId} />)}</div>}
          {record.followUpType !== "monitoring" && !record.supersededByCaseActionId && <button className={styles.textButton} type="button" disabled={saving || publicationTarget != null || pendingPhoto != null} onClick={() => {
            setCorrectionId(record.caseActionId); setCorrectedTeam(record.responsibleTeam ?? "");
            setCorrectedOutcome(record.recordedOutcome ?? "");
            setCorrectedNotes(record.notes ?? "");
            setCorrectedDate(record.actionDate ? dateLabel(record.actionDate) : "");
            setCorrectedState(record.followUpState as typeof correctedState);
            setCorrectionReason(""); setError("");
          }}>Correct this record</button>}
        </li>)}
      </ol>}
      {publicationTarget && <section className={styles.publicationConfirmation} aria-labelledby="publication-confirm-heading">
        <h3 id="publication-confirm-heading">{publicationTarget.publish ? "Publish this follow-up?" : "Withdraw this follow-up?"}</h3>
        {publicationTarget.publish ? <>
          <p>This makes the recorded outcome available in public site activity. Check that the outcome contains no names, contact details, precise report locations or other private information.</p>
          <p><strong>Recorded outcome:</strong> {records.find((record) => record.caseActionId === publicationTarget.id)?.recordedOutcome}</p>
          <p>Private notes, team names, source references and evidence are not part of this public summary. An external outcome remains externally reported, not a verified ReefCare action.</p>
        </> : <p>The follow-up will be removed from public site activity. Its internal record and safe private Observer feedback remain available.</p>}
        <div className={styles.buttons}>
          <button type="button" disabled={saving} onClick={() => setPublicationTarget(null)}>Cancel</button>
          <button type="button" disabled={saving} onClick={savePublication}>{saving ? "Saving publication…" : publicationTarget.publish ? "Confirm publication" : "Confirm withdrawal"}</button>
        </div>
      </section>}
      {correctionId != null && <form className={styles.form} onSubmit={saveCorrection}>
        <h3>Correct recorded details</h3><p>The original record remains in the audit history. A corrected version must be published again before it appears in public activity.</p>
        {records.find((record) => record.caseActionId === correctionId)?.followUpType === "action" && <label>Action stage
          <select value={correctedState} onChange={(event) => setCorrectedState(event.target.value as typeof correctedState)}>
            <option value="action_planned">Planned — not completed</option><option value="action_taken">Taken</option>
          </select></label>}
        <label>Follow-up date<DisplayDateInput label="Corrected follow-up date" value={correctedDate} onChange={setCorrectedDate} allowFuture={correctedState === "action_planned"} /></label>
        <label>Responsible team<input value={correctedTeam} onChange={(event) => setCorrectedTeam(event.target.value)} /></label>
        <label>Recorded outcome<textarea value={correctedOutcome} onChange={(event) => setCorrectedOutcome(event.target.value)} /></label>
        <label>Notes<textarea value={correctedNotes} onChange={(event) => setCorrectedNotes(event.target.value)} /></label>
        <label>Reason for correction *<textarea required value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
        <div className={styles.buttons}><button type="button" onClick={() => setCorrectionId(null)}>Cancel</button><button type="submit" disabled={saving}>Save correction</button></div>
      </form>}
      {assessed && <form className={styles.form} onSubmit={save}>
        <h3>Add a follow-up</h3>
        {referenceError && <p role="alert" className={styles.error}>{referenceError}</p>}
        <div className={styles.tabs} role="group" aria-label="Follow-up type">
          {(["action", "monitoring", "sourced_outcome"] as Mode[]).map((type) =>
            <button key={type} type="button" aria-pressed={mode === type} onClick={() => { setMode(type); setError(""); }}
              disabled={type === "action" && !actionAllowed}>{type === "sourced_outcome" ? "Sourced outcome" : readable(type)}</button>)}
        </div>
        {mode === "action" && <>
          <label>Action stage<select value={actionState} onChange={(event) => setActionState(event.target.value as "action_planned" | "action_taken")}>
            <option value="action_planned">Planned — not completed</option><option value="action_taken" disabled={!canRecordTaken}>Taken</option></select></label>
          <label>Action type<select value={actionTypeCode} onChange={(event) => setActionTypeCode(event.target.value)}>
            {actionTypes.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
          <label>Record source<select value={recordingLevel} onChange={(event) => setRecordingLevel(event.target.value as typeof recordingLevel)}>
            <option value="coordinator_summary">Coordinator summary</option><option value="responder_record">Responder record</option><option value="externally_sourced">Externally sourced</option></select></label>
        </>}
        <label>{mode === "action" && actionState === "action_planned" ? "Planned date (optional)" : "Date *"}
          <DisplayDateInput label="Follow-up date" value={date} onChange={setDate} required={mode !== "action" || actionState === "action_taken"} allowFuture={mode === "action" && actionState === "action_planned"} /></label>
        {mode !== "monitoring" && <label>Responsible team or organisation<input value={team} onChange={(event) => setTeam(event.target.value)} maxLength={255} /></label>}
        {mode === "sourced_outcome" && <label>Source reference *<input required value={source} onChange={(event) => setSource(event.target.value)} /></label>}
        {mode === "monitoring" && <>
          <label>Human-reviewed condition *<select value={conditionCode} onChange={(event) => setConditionCode(event.target.value)}>
            {conditions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
          <label>Site observations *<textarea required value={observations} onChange={(event) => setObservations(event.target.value)} /></label>
          <label className={styles.checkbox}><input type="checkbox" checked={nextRequired} onChange={(event) => { setNextRequired(event.target.checked); if (!event.target.checked) setNextDate(""); }} /> Another follow-up is required</label>
          {nextRequired ? <label>Next follow-up date *<DisplayDateInput label="Next follow-up date" value={nextDate} onChange={setNextDate} required allowFuture /></label>
            : <p className={styles.notice}>No follow-up currently scheduled.</p>}
        </>}
        {mode !== "monitoring" && <label>Recorded outcome{mode === "sourced_outcome" ? " *" : ""}
          <textarea required={mode === "sourced_outcome"} value={outcome} onChange={(event) => setOutcome(event.target.value)} /></label>}
        <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <label>Supporting photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={saving || pendingPhoto != null} />{photo && <small>{photo.name}</small>}</label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.success} role="status">{notice}</p>}
        {pendingPhoto && <aside className={styles.notice}><p>The follow-up is already saved. Retry {pendingPhoto.file.name} without creating another record.</p><button type="button" disabled={saving} onClick={retryPhoto}>Retry photo upload</button></aside>}
        <button className={styles.save} type="submit" disabled={saving || pendingPhoto != null}>{saving ? "Saving…" : "Save follow-up"}</button>
      </form>}
      {!assessed && <p className={styles.notice}>Follow-up can be recorded after the evidence assessment.</p>}
      {!assessed && error && <p role="alert" className={styles.error}>{error}</p>}
      {!assessed && notice && <p role="status" className={styles.success}>{notice}</p>}
    </>}
  </section>;
}

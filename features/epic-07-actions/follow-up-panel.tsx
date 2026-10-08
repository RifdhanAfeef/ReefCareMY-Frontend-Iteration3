"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { getConservationActionTypes, getCoordinatorEvidence, uploadConservationActionEvidence } from "@/lib/api/coordinatorApi";
import {
  correctFollowUp, createFollowUp, createMonitoring, getFollowUps, getMonitoringConditions,
} from "@/lib/api/iteration3Api";
import type { ConservationActionTypeOption } from "@/lib/api/types";
import type { FollowUp, FollowUpCorrection, MonitoringCondition } from "@/lib/api/iteration3-types";
import { displayDateToIsoDate, isFutureDisplayDate, isValidDisplayDate } from "@/lib/format/date";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./follow-up-panel.module.css";

type Mode = "action" | "monitoring" | "sourced_outcome";
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 10 * 1024 * 1024;
const dateLabel = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Not recorded";
const readable = (value: string) => value.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());

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
  const [pendingPhoto, setPendingPhoto] = useState<{ actionId: number; file: File } | null>(null);
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

  async function attachPhoto(actionId: number, file: File) {
    await uploadConservationActionEvidence(reportReference, actionId, file);
    await reload();
    setPendingPhoto(null);
  }

  async function retryPhoto() {
    if (!pendingPhoto) return;
    setSaving(true); setError("");
    try { await attachPhoto(pendingPhoto.actionId, pendingPhoto.file); setNotice("The evidence photo was attached."); }
    catch (requestError) { setError(userFacingError(requestError, "The photo could not be attached. Try again.")); }
    finally { setSaving(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
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
      await reload();
      setNotice(mode === "action" && actionState === "action_planned"
        ? "The planned action was recorded. It has not been completed."
        : mode === "sourced_outcome" ? "The sourced outcome was recorded."
          : mode === "monitoring" ? "The monitoring visit was recorded." : "The completed action was recorded.");
      if (photo) {
        try { await attachPhoto(saved.caseActionId, photo); }
        catch (requestError) {
          setPendingPhoto({ actionId: saved.caseActionId, file: photo });
          setError(userFacingError(requestError, "The record was saved, but its photo could not be attached. Try the upload again."));
        }
      }
      setDate(""); setTeam(""); setOutcome(""); setSource(""); setObservations(""); setNotes(""); setPhoto(null); setNextDate(""); setNextRequired(false);
    } catch (requestError) { setError(userFacingError(requestError, "The follow-up could not be saved.")); }
    finally { setSaving(false); }
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    setSaving(true); setError("");
    try {
      await correctFollowUp(reportReference, correctionId, changes);
      await reload(); setCorrectionId(null); setCorrectionReason(""); setNotice("The correction was recorded; the original remains in the audit history.");
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
          {(record.evidence?.length ?? 0) > 0 && <div className={styles.photos}>{record.evidence.map((evidence) =>
            <EvidencePreview key={evidence.evidenceId} reportReference={reportReference} evidenceId={evidence.evidenceId} />)}</div>}
          {record.followUpType !== "monitoring" && <button className={styles.textButton} type="button" onClick={() => {
            setCorrectionId(record.caseActionId); setCorrectedTeam(record.responsibleTeam ?? "");
            setCorrectedOutcome(record.recordedOutcome ?? "");
            setCorrectedNotes(record.notes ?? "");
            setCorrectedDate(record.actionDate ? dateLabel(record.actionDate) : "");
            setCorrectedState(record.followUpState as typeof correctedState);
            setCorrectionReason(""); setError("");
          }}>Correct this record</button>}
        </li>)}
      </ol>}
      {correctionId != null && <form className={styles.form} onSubmit={saveCorrection}>
        <h3>Correct recorded details</h3><p>The original record remains in the audit history.</p>
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
        <label>Supporting photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />{photo && <small>{photo.name}</small>}</label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.success} role="status">{notice}</p>}
        {pendingPhoto && <button type="button" disabled={saving} onClick={retryPhoto}>Retry photo upload</button>}
        <button className={styles.save} type="submit" disabled={saving}>{saving ? "Saving…" : "Save follow-up"}</button>
      </form>}
      {!assessed && <p className={styles.notice}>Follow-up can be recorded after the evidence assessment.</p>}
      {!assessed && error && <p role="alert" className={styles.error}>{error}</p>}
      {!assessed && notice && <p role="status" className={styles.success}>{notice}</p>}
    </>}
  </section>;
}

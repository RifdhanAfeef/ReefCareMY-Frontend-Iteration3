"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import {
  createConservationAction,
  getConservationActions,
  getConservationActionTypes,
  getCoordinatorEvidence,
  uploadConservationActionEvidence,
} from "@/lib/api/coordinatorApi";
import type {
  ConservationAction,
  ConservationActionState,
  ConservationActionTypeOption,
} from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import {
  displayDateToIsoDate,
  formatDateTime,
  isFutureDisplayDate,
  isValidDisplayDate,
} from "@/lib/format/date";
import styles from "./conservation-action.module.css";

const actionStateLabels: Record<ConservationActionState, string> = {
  action_planned: "Action planned — not completed",
  action_taken: "Action taken",
};

const supportedEvidenceTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumEvidenceSize = 10 * 1024 * 1024;

function displayCalendarDate(value: string | null) {
  if (!value) return "Not provided";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function displayCreatedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTime(parsed);
}

function ActionEvidencePreview({
  reportReference,
  evidenceId,
  actionLabel,
  index,
}: {
  reportReference: string;
  evidenceId: number;
  actionLabel: string;
  index: number;
}) {
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
        if (!cancelled) {
          setError(userFacingError(requestError, "This action evidence image could not be loaded."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceId, reportReference, retryKey]);

  function retry() {
    setEvidenceUrl("");
    setError("");
    setLoading(true);
    setRetryKey((value) => value + 1);
  }

  return (
    <div className={styles.actionEvidenceItem}>
      {loading && <span role="status">Loading action evidence…</span>}
      {evidenceUrl && (
        <Image
          src={evidenceUrl}
          alt={`Action evidence ${index + 1} for ${actionLabel}`}
          width={360}
          height={240}
          unoptimized
        />
      )}
      {error && <div><p role="alert">{error}</p><button type="button" onClick={retry}>Try again</button></div>}
    </div>
  );
}

function ActionHistory({
  actions,
  reportReference,
}: {
  actions: ConservationAction[];
  reportReference: string;
}) {
  if (actions.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <strong>No conservation action has been recorded yet</strong>
        <p>Use the form to record a planned action or confirmed action taken.</p>
      </div>
    );
  }

  return (
    <ol className={styles.historyList} aria-label="Recorded conservation actions">
      {actions.map((action) => (
        <li className={styles.historyItem} key={action.caseActionId}>
          <div className={styles.historyHeading}>
            <div>
              <span className={styles[action.actionState]}>{actionStateLabels[action.actionState]}</span>
              <h3>{action.actionTypeLabel}</h3>
            </div>
            <time dateTime={action.createdAt}>{displayCreatedAt(action.createdAt)}</time>
          </div>
          <dl className={styles.actionDetails}>
            <div><dt>Action date</dt><dd>{displayCalendarDate(action.actionDate)}</dd></div>
            <div><dt>Responsible team</dt><dd>{action.responsibleTeam || "Not provided"}</dd></div>
            <div><dt>Recorded by</dt><dd>{action.createdByName?.trim() || "Coordinator name unavailable"}</dd></div>
          </dl>
          {action.notes && <p className={styles.notes}>{action.notes}</p>}
          {(action.evidence?.length ?? 0) > 0 && <section className={styles.actionEvidence} aria-label={`Supporting evidence for ${action.actionTypeLabel}`}>
            <div className={styles.actionEvidenceHeading}>
              <strong>Supporting evidence</strong>
              <span>{action.evidence?.length} image{action.evidence?.length === 1 ? "" : "s"}</span>
            </div>
            <div className={styles.actionEvidenceGrid}>
              {action.evidence?.map((evidence, index) => (
                <ActionEvidencePreview
                  key={evidence.evidenceId}
                  reportReference={reportReference}
                  evidenceId={evidence.evidenceId}
                  actionLabel={action.actionTypeLabel}
                  index={index}
                />
              ))}
            </div>
          </section>}
          {action.actionState === "action_planned" && (
            <p className={styles.plannedReminder}>This is a plan only. It does not confirm that conservation work has happened.</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function ConservationActionPanel({
  reportReference,
  onEvidenceIdsChange,
}: {
  reportReference: string;
  onEvidenceIdsChange?: (evidenceIds: number[]) => void;
}) {
  const [actionTypes, setActionTypes] = useState<ConservationActionTypeOption[]>([]);
  const [actions, setActions] = useState<ConservationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionState, setActionState] = useState<ConservationActionState>("action_planned");
  const [actionTypeCode, setActionTypeCode] = useState("");
  const [actionDate, setActionDate] = useState("");
  const [responsibleTeam, setResponsibleTeam] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [pendingEvidence, setPendingEvidence] = useState<{ actionId: number; file: File } | null>(null);

  useEffect(() => {
    onEvidenceIdsChange?.(
      actions.flatMap((action) => (action.evidence ?? []).map((evidence) => evidence.evidenceId)),
    );
  }, [actions, onEvidenceIdsChange]);

  async function retryLoad() {
    setLoading(true);
    setLoadError("");
    try {
      const [types, recorded] = await Promise.all([
        getConservationActionTypes(),
        getConservationActions(reportReference),
      ]);
      setActionTypes(types);
      setActions(recorded.items);
      setActionTypeCode((current) => current || types[0]?.code || "");
    } catch (requestError) {
      setLoadError(userFacingError(requestError, "Conservation actions could not be loaded. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getConservationActionTypes(),
      getConservationActions(reportReference),
    ]).then(([types, recorded]) => {
      if (cancelled) return;
      setActionTypes(types);
      setActions(recorded.items);
      setActionTypeCode((current) => current || types[0]?.code || "");
    }).catch((requestError) => {
      if (!cancelled) {
        setLoadError(userFacingError(requestError, "Conservation actions could not be loaded. Please try again."));
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reportReference]);

  const selectedActionType = useMemo(
    () => actionTypes.find((item) => item.code === actionTypeCode) ?? null,
    [actionTypeCode, actionTypes],
  );

  function chooseEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFormError("");
    if (!file) return;
    if (!supportedEvidenceTypes.includes(file.type)) {
      setEvidenceFile(null);
      setFormError("Choose a JPG, PNG or WebP evidence image.");
      return;
    }
    if (file.size === 0) {
      setEvidenceFile(null);
      setFormError("The selected evidence file is empty.");
      return;
    }
    if (file.size > maximumEvidenceSize) {
      setEvidenceFile(null);
      setFormError("The evidence image must be 10 MB or smaller.");
      return;
    }
    setEvidenceFile(file);
  }

  async function retryEvidenceUpload() {
    if (!pendingEvidence) return;
    setSubmitting(true);
    setFormError("");
    try {
      const uploaded = await uploadConservationActionEvidence(
        reportReference,
        pendingEvidence.actionId,
        pendingEvidence.file,
      );
      setActions((current) => current.map((action) => action.caseActionId === pendingEvidence.actionId
        ? { ...action, evidence: [...(action.evidence ?? []), uploaded] }
        : action));
      setPendingEvidence(null);
      setSuccessMessage("The evidence image is now attached to the conservation action.");
    } catch (requestError) {
      setFormError(userFacingError(requestError, "The evidence image could not be attached. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!actionTypeCode) {
      setFormError("Choose an action type.");
      return;
    }
    if (!responsibleTeam.trim()) {
      setFormError("Enter the team responsible for this action.");
      return;
    }
    if (actionState === "action_taken" && !actionDate) {
      setFormError("Enter the date the action was taken.");
      return;
    }
    if (actionDate && !isValidDisplayDate(actionDate)) {
      setFormError("Enter a valid date in dd/mm/yyyy format.");
      return;
    }
    if (actionState === "action_taken" && isFutureDisplayDate(actionDate)) {
      setFormError("The date of a completed action cannot be in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = await createConservationAction(reportReference, {
        actionTypeCode,
        actionState,
        actionDate: actionDate ? displayDateToIsoDate(actionDate) : null,
        responsibleTeam: responsibleTeam.trim(),
        notes: notes.trim() || null,
      });
      setActions((current) => [...current, saved]);
      let evidenceAttached = false;
      if (evidenceFile) {
        try {
          const uploaded = await uploadConservationActionEvidence(reportReference, saved.caseActionId, evidenceFile);
          setActions((current) => current.map((action) => action.caseActionId === saved.caseActionId
            ? { ...action, evidence: [...(action.evidence ?? []), uploaded] }
            : action));
          evidenceAttached = true;
        } catch (requestError) {
          setPendingEvidence({ actionId: saved.caseActionId, file: evidenceFile });
          setFormError(userFacingError(requestError, "The action was recorded, but its evidence image could not be attached. Try the upload again below."));
        }
      }
      setSuccessMessage(`${actionState === "action_taken"
        ? "The completed conservation action was recorded."
        : "The planned conservation action was recorded without marking it as completed."}${evidenceAttached ? " The evidence image was attached." : ""}`);
      setActionState("action_planned");
      setActionDate("");
      setResponsibleTeam("");
      setNotes("");
      setEvidenceFile(null);
    } catch (requestError) {
      setFormError(userFacingError(requestError, "The conservation action could not be recorded. Please check the details and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="conservation-action-heading">
      <header className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Conservation action</p>
          <h2 id="conservation-action-heading">Action record</h2>
        </div>
        <p>Record what is planned separately from what has actually happened.</p>
      </header>

      {loading && <div className={styles.loadingState} role="status">Loading conservation actions…</div>}
      {loadError && (
        <div className={styles.errorBox} role="alert">
          <strong>Actions unavailable</strong>
          <p>{loadError}</p>
          <button type="button" onClick={() => void retryLoad()}>Try again</button>
        </div>
      )}

      {!loading && !loadError && (
        <div className={styles.contentGrid}>
          <section className={styles.historySection} aria-labelledby="action-history-heading">
            <h3 id="action-history-heading">Case action history</h3>
            <ActionHistory actions={actions} reportReference={reportReference} />
          </section>

          <form className={styles.actionForm} onSubmit={saveAction} noValidate>
            <h3>Record an action update</h3>
            <p className={styles.formIntroduction}>Each update is added to this case history and does not replace earlier records.</p>

            <fieldset className={styles.stateOptions} disabled={submitting}>
              <legend>Action state</legend>
              <label>
                <input type="radio" name="actionState" value="action_planned" checked={actionState === "action_planned"} onChange={() => setActionState("action_planned")} />
                <span><strong>Action planned</strong><small>A future or intended response; no completion is claimed.</small></span>
              </label>
              <label>
                <input type="radio" name="actionState" value="action_taken" checked={actionState === "action_taken"} onChange={() => setActionState("action_taken")} />
                <span><strong>Action taken</strong><small>Use only when the work has actually occurred.</small></span>
              </label>
            </fieldset>

            <label className={styles.field}>
              <span>Action type *</span>
              <select value={actionTypeCode} onChange={(event) => setActionTypeCode(event.target.value)} disabled={submitting} required>
                <option value="">Select an action</option>
                {actionTypes.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
              {selectedActionType?.description && <small>{selectedActionType.description}</small>}
            </label>

            <div className={styles.field}>
              <span>{actionState === "action_taken" ? "Date action was taken *" : "Planned action date"}</span>
              <DisplayDateInput
                label={actionState === "action_taken" ? "Date action was taken" : "Planned action date"}
                value={actionDate}
                onChange={setActionDate}
                required={actionState === "action_taken"}
                allowFuture={actionState === "action_planned"}
                disabled={submitting}
              />
            </div>

            <label className={styles.field}>
              <span>Responsible team *</span>
              <input type="text" value={responsibleTeam} onChange={(event) => setResponsibleTeam(event.target.value)} maxLength={200} placeholder="For example, Tioman response team" disabled={submitting} required />
            </label>

            <label className={styles.field}>
              <span>Action notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Describe the planned or completed conservation work." disabled={submitting} />
              <small>{notes.length}/2000 characters</small>
            </label>

            <section className={styles.evidenceUpload} aria-labelledby="action-evidence-heading">
              <div>
                <strong id="action-evidence-heading">Supporting evidence <span>Optional</span></strong>
                <p>Attach one image that supports this planned or completed action.</p>
                <small>JPG, PNG or WebP. Maximum 10 MB.</small>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseEvidence} disabled={submitting} aria-label="Choose action evidence image" />
              {evidenceFile && <div className={styles.selectedEvidence}><span>{evidenceFile.name}</span><button type="button" onClick={() => setEvidenceFile(null)} disabled={submitting}>Remove</button></div>}
            </section>

            {pendingEvidence && <aside className={styles.evidenceRetry} role="alert"><strong>Evidence still needs uploading</strong><p>{pendingEvidence.file.name} belongs to the action that was just recorded.</p><button type="button" onClick={() => void retryEvidenceUpload()} disabled={submitting}>{submitting ? "Uploading…" : "Retry evidence upload"}</button></aside>}

            {formError && <p className={styles.formError} role="alert">{formError}</p>}
            <button className={styles.submitButton} type="submit" disabled={submitting || actionTypes.length === 0}>
              {submitting ? "Recording action…" : "Record action update"}
            </button>
          </form>
        </div>
      )}
      {successMessage && <footer className={styles.completionMessage} role="status">
        <div><strong>Action update saved</strong><p>{successMessage}</p></div>
        <Link href="/coordinator/my-cases">Back to My Cases</Link>
      </footer>}
    </section>
  );
}

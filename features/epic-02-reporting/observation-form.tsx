"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { useMockAppState } from "@/features/shared/mock-app-state";
import {
  dateToMalaysiaFormValues,
  formatDateTime,
  inputDateToDisplayValue,
  isFutureDisplayDate,
  isValidDisplayDate,
} from "@/lib/format/date";
import { getThreatCategories } from "@/lib/api/referenceApi";
import { structureReportDescription, type SmartReportFollowUpQuestion } from "@/lib/api/smartReportApi";
import { recognizeVisualThreat } from "@/lib/api/visualRecognitionApi";
import type { ThreatCategoryReference } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import {
  applySuggestionValue,
  contextualFollowUps,
  mergeSmartReportSuggestions,
  normaliseSmartReportField,
  observerValueFor,
  smartReportFields,
  suggestionStateLabel,
} from "./smart-report-state";
import { clearDraftPhotos, createPhotoId, loadDraftPhotos, saveDraftPhotos, type StoredDraftPhoto } from "./draft-storage";
import { readExifCaptureTime } from "./photo-exif";
import {
  clearSelectedReefSite,
  readSelectedReefSite,
  selectedReefSiteClearedEvent,
  type StoredReefSite,
} from "@/features/epic-02-reef-explorer/selected-site-storage";
import type { ReportDraft } from "./types";
import { confidenceLabel, visualRecognitionDraft } from "./visual-recognition-state";
import { ReportProgress } from "./report-progress";
import styles from "./reporting.module.css";

type PhotoPreview = StoredDraftPhoto & { previewUrl: string };
type FieldErrors = Partial<Record<"photos" | "threat" | "date" | "time" | "depth" | "description", string>>;
const allowedPhotoTypes = ["image/png", "image/jpeg", "image/webp"];
const threatIcons: Partial<Record<string, string>> = {
  ghost_gear: "/images/threats/ghost-fishing-gear-icon.png",
  coral_bleaching: "/images/threats/coral-bleaching-icon-v2.png",
  marine_debris: "/images/threats/marine-debris-icon.png",
  physical_reef_damage: "/images/threats/physical-reef-damage-icon-v2.png",
};
// Error summary order follows the form's visual order.
const errorFields: Array<{ key: keyof FieldErrors; target: string }> = [
  { key: "threat", target: "threat-picker" },
  { key: "photos", target: "report-photos" },
  { key: "date", target: "observation-date" },
  { key: "time", target: "observation-time" },
  { key: "depth", target: "observation-depth" },
  { key: "description", target: "observation-description" },
];
const maximumPhotoSize = 10 * 1024 * 1024;

// Capture times by photo id, read from each photo's EXIF data (null when it has none).
export type PhotoCaptureTimes = Record<string, string | null>;

/** Reads EXIF capture times for photos that do not have recorded metadata yet. */
export async function readPhotoCaptureTimes(photos: StoredDraftPhoto[], existingPhotos: ReportDraft["photos"]) {
  const pending = photos.filter((photo) => !existingPhotos.some((item) => item.id === photo.id));
  const times = await Promise.all(pending.map((photo) => readExifCaptureTime(photo.file)));
  return Object.fromEntries(pending.map((photo, index) => [photo.id, times[index]])) as PhotoCaptureTimes;
}

function photoMetadata(photo: StoredDraftPhoto, existing: ReportDraft["photos"][number] | undefined, captureTimes: PhotoCaptureTimes) {
  const capturedAt = existing?.capturedAt ?? captureTimes[photo.id] ?? null;
  return {
    id: photo.id,
    name: photo.file.name,
    type: photo.file.type,
    size: photo.file.size,
    capturedAt,
    capturedAtConfirmed: Boolean(capturedAt),
  };
}

export function buildAutomaticPhotoDraftChanges(
  photos: StoredDraftPhoto[],
  existingPhotos: ReportDraft["photos"],
  observationDate: string,
  observationTime: string,
  captureTimes: PhotoCaptureTimes = {},
) {
  const metadata = photos.map((photo) => photoMetadata(
    photo,
    existingPhotos.find((item) => item.id === photo.id),
    captureTimes,
  ));
  const capturedAt = metadata.find((photo) => photo.capturedAt)?.capturedAt;
  const automaticValues = capturedAt ? dateToMalaysiaFormValues(capturedAt) : null;
  return {
    changes: {
      photos: metadata,
      ...(!observationDate && automaticValues ? { observationDate: automaticValues.date } : {}),
      ...(!observationTime && automaticValues ? { observationTime: automaticValues.time } : {}),
    } satisfies Partial<ReportDraft>,
    automaticValues,
  };
}

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function ObservationForm({ initialThreat, fromExplorer = false, plannedDate }: { initialThreat?: string; fromExplorer?: boolean; plannedDate?: string }) {
  const router = useRouter();
  const { reportDraft, isAccountDraftRestored, updateReportDraft, saveReportDraft, resetReportDraft } = useMockAppState();
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploadMessage, setUploadMessage] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resettingReport, setResettingReport] = useState(false);
  const [resetError, setResetError] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<ThreatCategoryReference[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState("");
  const [selectedReefSite, setSelectedReefSite] = useState<StoredReefSite | null>(null);
  const previewUrls = useRef<string[]>([]);
  const latestReportDraft = useRef(reportDraft);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<SmartReportFollowUpQuestion[]>([]);
  const smartStructuringRequest = useRef(0);
  const visualRecognitionRequest = useRef(0);
  const [visualRecognitionBusy, setVisualRecognitionBusy] = useState(false);
  const [visualRecognitionMessage, setVisualRecognitionMessage] = useState("");
  const ignoreInitialHandoff = useRef(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const lastStructuredDescription = useRef(
    reportDraft.aiSuggestions.length > 0 ? reportDraft.description.trim() : "",
  );

  useEffect(() => {
    latestReportDraft.current = reportDraft;
  }, [reportDraft]);

  useEffect(() => {
    if (submitAttempt > 0) errorSummaryRef.current?.focus();
  }, [submitAttempt]);

  const runSmartStructuring = useCallback(async (description: string, requestId: number) => {
    setAssistantBusy(true);
    setAssistantMessage("Analysing your description…");
    try {
      const result = await structureReportDescription(description);
      if (requestId !== smartStructuringRequest.current) return;
      lastStructuredDescription.current = description;
      if (!result.available) {
        setAssistantMessage(result.message ?? "Smart Report Structuring is unavailable. Continue manually.");
        return;
      }
      const nextSuggestions = mergeSmartReportSuggestions(reportDraft, result.suggestions);
      const automaticChanges: Partial<ReportDraft> = { aiSuggestions: nextSuggestions };
      let nextReport = { ...reportDraft, ...automaticChanges };
      for (const suggestion of nextSuggestions) {
        if (suggestion.status !== "unresolved" || suggestion.conflict) continue;
        if (suggestion.field === "possible_threat" && !nextReport.threatCategoryCode) {
          const changes = applySuggestionValue(nextReport, suggestion, categoryOptions);
          Object.assign(automaticChanges, changes);
          nextReport = { ...nextReport, ...changes };
        }
        if (suggestion.field === "estimated_depth_metres" && !nextReport.estimatedDepthMetres) {
          const changes = applySuggestionValue(nextReport, suggestion, categoryOptions);
          Object.assign(automaticChanges, changes);
          nextReport = { ...nextReport, ...changes };
        }
      }
      updateReportDraft(automaticChanges);
      setFollowUpQuestions(contextualFollowUps(nextReport, result.followUpQuestions));
      if (result.missingFields.length > 0) {
        setAssistantMessage(`Consider adding: ${result.missingFields.join(", ")}.`);
      } else if (result.warnings.length > 0) {
        setAssistantMessage(result.warnings.join(" "));
      } else {
        setAssistantMessage("Suggested details have been added to the report fields for final review.");
      }
    } catch (error) {
      if (requestId !== smartStructuringRequest.current) return;
      setAssistantMessage(userFacingError(error, "Smart Report Structuring is unavailable. Continue manually."));
    } finally {
      if (requestId === smartStructuringRequest.current) setAssistantBusy(false);
    }
  }, [categoryOptions, reportDraft, updateReportDraft]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!fromExplorer) clearSelectedReefSite();
      setSelectedReefSite(fromExplorer ? readSelectedReefSite() : null);
    }, 0);

    const clearFreshReportState = () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      setPhotos([]);
      setSelectedReefSite(null);
      setErrors({});
      setUploadMessage("");
      setAssistantMessage("");
      visualRecognitionRequest.current += 1;
      setVisualRecognitionBusy(false);
      setVisualRecognitionMessage("");
      setFollowUpQuestions([]);
    };
    window.addEventListener(selectedReefSiteClearedEvent, clearFreshReportState);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(selectedReefSiteClearedEvent, clearFreshReportState);
    };
  }, [fromExplorer]);

  useEffect(() => {
    // Wait for the authenticated account's local draft before restoring photo
    // files. Otherwise photo metadata can populate an empty initial draft just
    // before the user's saved observation date/time is hydrated.
    if (isAccountDraftRestored === false) return;
    let cancelled = false;
    loadDraftPhotos()
      .then(async (stored) => {
        if (cancelled) return;
        const captureTimes = await readPhotoCaptureTimes(stored, latestReportDraft.current.photos);
        if (cancelled) return;
        const hydratedDraft = latestReportDraft.current;
        const restored = stored.map((photo) => {
          const previewUrl = URL.createObjectURL(photo.file);
          previewUrls.current.push(previewUrl);
          return { ...photo, previewUrl };
        });
        setPhotos(restored);
        const { changes } = buildAutomaticPhotoDraftChanges(
          stored,
          hydratedDraft.photos,
          hydratedDraft.observationDate,
          hydratedDraft.observationTime,
          captureTimes,
        );
        updateReportDraft(changes);
      })
      .catch(() => setUploadMessage("Saved photos could not be restored in this browser. Please select them again."));
    return () => {
      cancelled = true;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isAccountDraftRestored, updateReportDraft]);

  useEffect(() => {
    const description = reportDraft.description.trim();
    const requestId = ++smartStructuringRequest.current;
    if (!description) {
      lastStructuredDescription.current = "";
      return;
    }
    if (description === lastStructuredDescription.current) return;

    setAssistantMessage("AI suggestions will update automatically when you pause typing.");
    const timeoutId = window.setTimeout(() => {
      void runSmartStructuring(description, requestId);
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [reportDraft.description, runSmartStructuring]);

  useEffect(() => {
    if (ignoreInitialHandoff.current || !initialThreat || reportDraft.threatCategoryCode || reportDraft.threatCategoryId) return;
    const matchedThreat = categoryOptions.find((category) => category.code === initialThreat);
    if (!matchedThreat) return;
    updateReportDraft({
      threatCategoryCode: matchedThreat.code,
      threatCategoryId: matchedThreat.threatCategoryId,
    });
  }, [categoryOptions, initialThreat, reportDraft.threatCategoryCode, reportDraft.threatCategoryId, updateReportDraft]);

  useEffect(() => {
    let cancelled = false;
    getThreatCategories()
      .then((categories) => {
        if (cancelled) return;
        setCategoryOptions(categories);
        const selected = categories.find((category) => category.code === reportDraft.threatCategoryCode);
        if (selected && reportDraft.threatCategoryId !== selected.threatCategoryId) {
          updateReportDraft({ threatCategoryId: selected.threatCategoryId });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCategoryLoadError(userFacingError(error, "Threat categories are temporarily unavailable. Please try again."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reportDraft.threatCategoryCode, reportDraft.threatCategoryId, updateReportDraft]);

  function updateField(changes: Partial<ReportDraft>, errorField?: keyof FieldErrors) {
    const nextReport = { ...reportDraft, ...changes };
    const manuallyChangedFields = new Set<string>();
    if ("threatCategoryCode" in changes || "threatCategoryId" in changes) manuallyChangedFields.add("possible_threat");
    if ("estimatedDepthMetres" in changes) manuallyChangedFields.add("estimated_depth_metres");
    const aiSuggestions = manuallyChangedFields.size > 0
      ? reportDraft.aiSuggestions.map((suggestion) => {
        if (!manuallyChangedFields.has(suggestion.field)) return suggestion;
        const observerValue = observerValueFor(nextReport, suggestion.field);
        return observerValue
          ? { ...suggestion, suggestedValue: observerValue, observerValue, status: "corrected" as const, conflict: false }
          : { ...suggestion, observerValue: null, status: "unresolved" as const, conflict: false };
      })
      : reportDraft.aiSuggestions;
    const recognition = reportDraft.visualRecognition;
    const selectedThreatCode = changes.threatCategoryCode;
    const visualRecognition = recognition?.status === "recognized" && selectedThreatCode !== undefined
      ? {
          ...recognition,
          resolution: !selectedThreatCode
            ? "unresolved" as const
            : selectedThreatCode === recognition.suggestedThreatCode
              ? "accepted" as const
              : "changed" as const,
        }
      : recognition;
    updateReportDraft({ ...changes, aiSuggestions, visualRecognition });
    if (errorField) setErrors((current) => ({ ...current, [errorField]: undefined }));
  }

  async function syncPhotos(next: PhotoPreview[]) {
    const captureTimes = await readPhotoCaptureTimes(next, reportDraft.photos);
    const { changes, automaticValues } = buildAutomaticPhotoDraftChanges(
      next,
      reportDraft.photos,
      reportDraft.observationDate,
      reportDraft.observationTime,
      captureTimes,
    );
    setPhotos(next);
    updateReportDraft(changes);
    if (automaticValues) {
      setErrors((current) => ({ ...current, date: undefined, time: undefined }));
    }
    await saveDraftPhotos(next.map(({ id, file }) => ({ id, file })));
    return automaticValues;
  }

  async function analysePhoto(photo: PhotoPreview) {
    const requestId = ++visualRecognitionRequest.current;
    setVisualRecognitionBusy(true);
    setVisualRecognitionMessage(`Analysing ${photo.file.name}…`);
    try {
      const result = await recognizeVisualThreat(photo.file);
      if (requestId !== visualRecognitionRequest.current) return;
      updateReportDraft({
        visualRecognition: visualRecognitionDraft(photo.id, photo.file.name, result),
      });
      setVisualRecognitionMessage(result.status === "recognized"
        ? "Image analysis is ready. This is only a suggestion and will need your review."
        : result.warning ?? "No supported threat could be suggested. Continue the report manually.");
    } catch (error) {
      if (requestId !== visualRecognitionRequest.current) return;
      const warning = userFacingError(error, "Visual recognition is temporarily unavailable. You can continue the report manually.");
      updateReportDraft({
        visualRecognition: {
          photoId: photo.id,
          photoName: photo.file.name,
          status: "unavailable",
          suggestedThreatCode: null,
          suggestedThreatLabel: null,
          confidence: null,
          warning,
          resolution: "not_required",
        },
      });
      setVisualRecognitionMessage(warning);
    } finally {
      if (requestId === visualRecognitionRequest.current) setVisualRecognitionBusy(false);
    }
  }

  async function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    const emptyFile = selected.find((file) => file.size === 0);
    const invalidType = selected.find((file) => !allowedPhotoTypes.includes(file.type));
    const tooLarge = selected.find((file) => file.size > maximumPhotoSize);
    if (emptyFile) { setUploadMessage(`${emptyFile.name} is empty. Choose a valid photograph.`); return; }
    if (invalidType) { setUploadMessage(`${invalidType.name} is not supported. Choose a PNG, JPG or WebP image.`); return; }
    if (tooLarge) { setUploadMessage(`${tooLarge.name} is larger than the 10 MB limit.`); return; }

    const existingIds = new Set(photos.map((photo) => photo.id));
    const additions = selected
      .map((file) => ({ id: createPhotoId(file), file }))
      .filter((photo) => !existingIds.has(photo.id))
      .map((photo) => {
        const previewUrl = URL.createObjectURL(photo.file);
        previewUrls.current.push(previewUrl);
        return { ...photo, previewUrl };
      });
    if (additions.length === 0) { setUploadMessage("Those photos are already attached to this draft."); return; }
    try {
      const automaticValues = await syncPhotos([...photos, ...additions]);
      setErrors((current) => ({ ...current, photos: undefined }));
      setUploadMessage(automaticValues
        ? `${additions.length} photo${additions.length === 1 ? "" : "s"} attached. The photo date and time were added to the observation fields; review them before continuing.`
        : `${additions.length} photo${additions.length === 1 ? "" : "s"} attached to this report draft.`);
      void analysePhoto(additions[0]);
    } catch {
      setUploadMessage("The photos could not be saved locally. Please try again.");
    }
  }

  async function removePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== removed?.previewUrl);
    const removingAnalysedPhoto = reportDraft.visualRecognition?.photoId === id;
    if (removingAnalysedPhoto) {
      visualRecognitionRequest.current += 1;
      setVisualRecognitionBusy(false);
      setVisualRecognitionMessage("");
    }
    await syncPhotos(photos.filter((photo) => photo.id !== id));
    if (removingAnalysedPhoto) updateReportDraft({ visualRecognition: null });
    setUploadMessage("Photo removed from the draft.");
  }

  function updateSuggestion(index: number, changes: Partial<ReportDraft["aiSuggestions"][number]>) {
    updateReportDraft({
      aiSuggestions: (reportDraft.aiSuggestions ?? []).map((suggestion, suggestionIndex) =>
        suggestionIndex === index
          ? { ...suggestion, ...changes, conflict: false, observerValue: changes.suggestedValue ?? suggestion.observerValue }
          : suggestion),
    });
  }

  function answerFollowUp(question: SmartReportFollowUpQuestion, answer: string) {
    const field = normaliseSmartReportField(question.field);
    if (!field) return;
    const existingIndex = reportDraft.aiSuggestions.findIndex((suggestion) => suggestion.field === field);
    const label = smartReportFields.find((item) => item.field === field)?.label ?? question.field;
    const answerSuggestion: ReportDraft["aiSuggestions"][number] = {
      source: "smart_report",
      field,
      label,
      suggestedValue: answer,
      confidence: null,
      status: "corrected",
      conflict: false,
      observerValue: answer,
    };
    updateReportDraft({
      aiSuggestions: existingIndex >= 0
        ? reportDraft.aiSuggestions.map((suggestion, index) => index === existingIndex ? answerSuggestion : suggestion)
        : [...reportDraft.aiSuggestions, answerSuggestion],
    });
    setFollowUpQuestions((current) => current.filter((item) => item.field !== question.field));
  }

  function useVisualSuggestion() {
    const recognition = reportDraft.visualRecognition;
    const category = categoryOptions.find(
      (item) => item.code === recognition?.suggestedThreatCode,
    );
    if (!recognition || !category) return;
    updateReportDraft({
      threatCategoryCode: category.code as ReportDraft["threatCategoryCode"],
      threatCategoryId: category.threatCategoryId,
      visualRecognition: { ...recognition, resolution: "accepted" },
    });
    setErrors((current) => ({ ...current, threat: undefined }));
  }

  function keepSelectedThreat() {
    const recognition = reportDraft.visualRecognition;
    if (!recognition || !reportDraft.threatCategoryId) return;
    updateReportDraft({
      visualRecognition: { ...recognition, resolution: "kept" },
    });
  }

  function validate() {
    const nextErrors: FieldErrors = {};
    if (photos.length === 0) nextErrors.photos = "Attach at least one photo before continuing.";
    if (!reportDraft.threatCategoryCode || !reportDraft.threatCategoryId) nextErrors.threat = "Select the closest threat category.";
    if (!reportDraft.observationDate) nextErrors.date = "Enter the observation date.";
    else if (!isValidDisplayDate(reportDraft.observationDate)) nextErrors.date = "Choose a valid observation date.";
    else if (isFutureDisplayDate(reportDraft.observationDate)) nextErrors.date = "Observation date cannot be in the future.";
    if (!reportDraft.observationTime) nextErrors.time = "Enter the approximate observation time.";
    if (reportDraft.estimatedDepthMetres && Number(reportDraft.estimatedDepthMetres) < 0) nextErrors.depth = "Depth cannot be negative.";
    if (!reportDraft.description.trim()) nextErrors.description = "Describe what you observed.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function saveDraft() {
    saveReportDraft();
    setUploadMessage("Draft saved on this device. You can return and continue later.");
  }

  async function confirmResetReport() {
    setResettingReport(true);
    setResetError("");
    try {
      await clearDraftPhotos();
      smartStructuringRequest.current += 1;
      visualRecognitionRequest.current += 1;
      ignoreInitialHandoff.current = true;
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      lastStructuredDescription.current = "";
      setPhotos([]);
      setErrors({});
      setAssistantMessage("");
      setAssistantBusy(false);
      setVisualRecognitionBusy(false);
      setVisualRecognitionMessage("");
      setFollowUpQuestions([]);
      setCategoryLoadError("");
      clearSelectedReefSite();
      resetReportDraft();
      setShowResetConfirmation(false);
      setUploadMessage("Report reset. You can start a fresh report.");
      router.replace("/report-a-reef");
    } catch {
      setResetError("The saved report could not be cleared from this device. Please try again.");
    } finally {
      setResettingReport(false);
    }
  }

  function continueToLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      setSubmitAttempt((value) => value + 1);
      return;
    }
    saveReportDraft();
    router.push("/report-a-reef/location");
  }

  function focusField(target: string) {
    const element = target === "threat-picker"
      ? document.querySelector<HTMLInputElement>("#threat-picker input:checked, #threat-picker input")
      : document.getElementById(target);
    element?.focus();
    element?.scrollIntoView({ block: "center" });
  }

  const visibleErrors = errorFields.filter(({ key }) => errors[key]);
  const threatSuggestion = reportDraft.aiSuggestions.find((item) => item.field === "possible_threat");
  const depthSuggestion = reportDraft.aiSuggestions.find((item) => item.field === "estimated_depth_metres");
  const selectedThreatLabel = categoryOptions.find((item) => item.code === reportDraft.threatCategoryCode)?.label;
  const orderedThreats = [...categoryOptions].sort((first, second) => Number(first.code === "unsure") - Number(second.code === "unsure"));
  const hasAiInput = photos.length > 0
    || Boolean(reportDraft.description.trim())
    || Boolean(reportDraft.visualRecognition)
    || reportDraft.aiSuggestions.length > 0;

  function suggestionHint(suggestion: typeof threatSuggestion, currentLabel: string | undefined) {
    if (!suggestion || suggestion.status !== "unresolved" || !suggestion.suggestedValue) return null;
    if (suggestion.conflict) {
      return <span className={styles.conflictText}>Your description suggests {suggestion.suggestedValue}, but you chose {suggestion.observerValue ?? currentLabel}. Check which is right before submitting.</span>;
    }
    return <span className={styles.suggestedHint}>Filled in from your description. Check it is right.</span>;
  }

  return (
    <form className={styles.formShell} onSubmit={continueToLocation} noValidate>
      <ReportProgress current={1} />
      {submitAttempt > 0 && visibleErrors.length > 0 && (
        <div className={styles.errorSummary} ref={errorSummaryRef} tabIndex={-1} role="alert" aria-labelledby="error-summary-heading">
          <h2 id="error-summary-heading">{visibleErrors.length === 1 ? "One thing needs fixing" : `${visibleErrors.length} things need fixing`} before you continue</h2>
          <ul>
            {visibleErrors.map(({ key, target }) => (
              <li key={key}><a href={`#${target}`} onClick={(event) => { event.preventDefault(); focusField(target); }}>{errors[key]}</a></li>
            ))}
          </ul>
        </div>
      )}
      {plannedDate && /^\d{4}-\d{2}-\d{2}$/.test(plannedDate) && !Number.isNaN(Date.parse(plannedDate)) && (
        <aside className={styles.selectedSiteNotice} aria-label="Dive plan context">
          <div><strong>Suggested by your dive plan</strong><span>{plannedDate} · Confirm your actual observation date below.</span></div>
          <button type="button" onClick={() => updateReportDraft({ observationDate: inputDateToDisplayValue(plannedDate) })}>Use suggested date</button>
          <p>Your plan is not evidence of a dive. Confirm your Dive Session and site in the location step.</p>
        </aside>
      )}
      {selectedReefSite && (
        <aside className={styles.selectedSiteNotice} aria-label="Selected reef site carried from Reef Explorer">
          <div>
            <strong>{plannedDate ? "Selected from your dive plan" : "Selected from Reef Explorer"}</strong>
            <span>{selectedReefSite.name} · {selectedReefSite.publicAreaLabel}</span>
          </div>
          <p>You can confirm or change this named site in the location step.</p>
        </aside>
      )}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div><h2>What you observed</h2><p>Record what you saw. Scientific identification is not required.</p></div>
          <span className={styles.requiredNote}>* Required</span>
        </div>

        <div className={styles.formGrid}>
          <section className={styles.uploadArea} aria-labelledby="photo-heading">
            <h3 id="photo-heading">Photographs *</h3>
            <p className={styles.supporting}>PNG, JPG or WebP, up to 10 MB each. A clear close photo and a wider one help most.</p>
            <div className={styles.uploadContent}>
              <input className={styles.fileInput} id="report-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={choosePhotos} aria-describedby={errors.photos ? "photos-error" : undefined} />
              <label className={styles.uploadLabel} htmlFor="report-photos">Choose photos</label>
              {errors.photos && <p className={styles.errorText} id="photos-error">{errors.photos}</p>}
              {uploadMessage && <p className={styles.muted} role="status">{uploadMessage}</p>}
              {photos.length > 0 && <div className={styles.photoGrid}>{photos.map((photo) => {
                const metadata = reportDraft.photos.find((item) => item.id === photo.id);
                return <article className={styles.photoCard} key={photo.id}>
                  <Image className={styles.photoImage} src={photo.previewUrl} alt={`Selected evidence: ${photo.file.name}`} width={360} height={220} unoptimized />
                  <div className={styles.photoMeta}><strong title={photo.file.name}>{photo.file.name}</strong><span>{formatFileSize(photo.file.size)}</span><div className={styles.compactActions}><button className={styles.smallButton} type="button" disabled={visualRecognitionBusy} onClick={() => analysePhoto(photo)}>{reportDraft.visualRecognition?.photoId === photo.id ? "Check again" : "Check this photo"}</button><button className={styles.textButton} type="button" onClick={() => removePhoto(photo.id)}>Remove</button></div></div>
                  {metadata?.capturedAt && <div className={styles.metadataPrompt}>
                    <strong>Photo date and time added</strong>
                    <span>{formatDateTime(new Date(metadata.capturedAt))}</span>
                    <p>Read from the camera data saved in the photo and copied into the date and time below. Check them and edit them if they are wrong.</p>
                  </div>}
                </article>;
              })}</div>}
            </div>
          </section>

          <div className={styles.whenRow}>
            <div className={styles.field}><label className={styles.fieldLabel} htmlFor="observation-date">Observation date *</label><DisplayDateInput id="observation-date" label="Observation date" required value={reportDraft.observationDate} onChange={(value) => updateField({ observationDate: value }, "date")} invalid={Boolean(errors.date)} describedBy={errors.date ? "observation-date-error" : undefined} />{errors.date && <span className={styles.errorText} id="observation-date-error">{errors.date}</span>}</div>
            <label className={styles.field}><span className={styles.fieldLabel}>Approximate time *</span><input id="observation-time" type="time" value={reportDraft.observationTime} onChange={(event) => updateField({ observationTime: event.target.value }, "time")} aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? "observation-time-error" : undefined} />{errors.time && <span className={styles.errorText} id="observation-time-error">{errors.time}</span>}</label>
            <label className={styles.field}><span className={styles.fieldLabel}>Approximate depth (m) <span className={styles.fieldMeta}>Optional</span></span><input id="observation-depth" type="number" min="0" step="0.1" inputMode="decimal" value={reportDraft.estimatedDepthMetres} onChange={(event) => updateField({ estimatedDepthMetres: event.target.value }, "depth")} aria-invalid={Boolean(errors.depth)} aria-describedby={errors.depth ? "observation-depth-error" : undefined} placeholder="e.g. 12" />{suggestionHint(depthSuggestion, reportDraft.estimatedDepthMetres)}{errors.depth && <span className={styles.errorText} id="observation-depth-error">{errors.depth}</span>}</label>
          </div>
          <label className={`${styles.field} ${styles.fullWidth}`}><span className={styles.fieldLabel}>Describe what you saw *</span><span className={styles.fieldHelp} id="description-help">Size, contact with coral or animals, and where on the reef, if you remember.</span><textarea id="observation-description" value={reportDraft.description} onChange={(event) => updateField({ description: event.target.value }, "description")} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-help description-error" : "description-help"} placeholder="Example: Large fishing net tangled around coral north of D'Lagoon, around 10-15 m deep." />{errors.description && <span className={styles.errorText} id="description-error">{errors.description}</span>}</label>
          <fieldset className={`${styles.threatPicker} ${styles.fullWidth}`} id="threat-picker" data-invalid={Boolean(errors.threat) || undefined} aria-describedby={errors.threat ? "threat-help threat-error" : "threat-help"}>
            <legend className={styles.fieldLabel}>What did you see? *</legend>
            <p className={styles.fieldHelp} id="threat-help">Your description may fill this in automatically. Check the result or choose the closest match. If you can&apos;t tell, choose &ldquo;Unsure&rdquo; and a coordinator will check.</p>
            {categoryOptions.length === 0 && !categoryLoadError && <p className={styles.muted} role="status">Loading threat types…</p>}
            {categoryLoadError && <p className={styles.errorText} role="alert">{categoryLoadError}</p>}
            {orderedThreats.length > 0 && <div className={styles.threatOptions}>
              {orderedThreats.map((category) => {
                const icon = threatIcons[category.code];
                return <label className={styles.threatOption} key={category.code}>
                  <input
                    type="radio"
                    name="threat-type"
                    value={category.code}
                    checked={reportDraft.threatCategoryCode === category.code}
                    onChange={() => updateField({ threatCategoryCode: category.code as ReportDraft["threatCategoryCode"], threatCategoryId: category.threatCategoryId }, "threat")}
                  />
                  <span className={styles.threatOptionIcon} aria-hidden="true">
                    {icon ? <Image src={icon} alt="" width={36} height={36} /> : <CircleHelp size={26} strokeWidth={2} />}
                  </span>
                  <span>{category.label}</span>
                </label>;
              })}
            </div>}
            {suggestionHint(threatSuggestion, selectedThreatLabel)}
            {errors.threat && <span className={styles.errorText} id="threat-error">{errors.threat}</span>}
          </fieldset>
        </div>

        <section className={styles.aiWorkspace} aria-labelledby="ai-assistance-heading">
          <header className={styles.aiWorkspaceHeader}>
            <h2 id="ai-assistance-heading">Suggestions from your photo and description</h2>
            <p>Optional. ReefCare can suggest details from what you add above. Check or edit the suggested details before continuing.</p>
          </header>

          {!hasAiInput ? <p className={styles.aiEmptyState}>Add a photo or a description and suggestions will appear here.</p> : <>
          <section className={styles.imageAnalysisPanel} aria-labelledby="visual-recognition-heading">
            <div className={styles.aiFeatureHeader}>
              <div><h3 id="visual-recognition-heading">Photo check</h3><p>Looks at your first new photo for one of the four supported threats.</p></div>
            </div>
            {visualRecognitionBusy ? <p className={styles.assistantMessage} role="status">{visualRecognitionMessage}</p> : reportDraft.visualRecognition ? <div className={styles.imageAnalysisResult}>
              <div><small>Possible threat in the photo</small><strong>{reportDraft.visualRecognition.suggestedThreatLabel ?? "No suggestion available"}</strong></div>
              {reportDraft.visualRecognition.status === "recognized" && <div><small>How sure the check is</small><strong>{confidenceLabel(reportDraft.visualRecognition.confidence)}</strong></div>}
              <p>{reportDraft.visualRecognition.warning ?? visualRecognitionMessage}</p>
              <small>A suggestion only. It does not verify the photo or replace your choice.</small>
              {reportDraft.visualRecognition.status === "recognized" && reportDraft.visualRecognition.resolution === "unresolved" && <div className={styles.imageAnalysisActions}>
                <button className={styles.smallButton} type="button" disabled={!categoryOptions.some((item) => item.code === reportDraft.visualRecognition?.suggestedThreatCode)} onClick={useVisualSuggestion}>Use image suggestion</button>
                <button className={styles.smallButton} type="button" disabled={!reportDraft.threatCategoryId} onClick={keepSelectedThreat}>Keep my selected threat</button>
              </div>}
              {reportDraft.visualRecognition.status === "recognized" && reportDraft.visualRecognition.resolution !== "unresolved" && <p className={styles.reviewedAnalysis}>Reviewed. Your chosen threat stays in the report.</p>}
            </div> : <p className={styles.aiEmptyState}>Add a photo above and it will be checked automatically.</p>}
          </section>

          <section className={styles.assistantCard} aria-labelledby="smart-report-heading">
          <div className={styles.assistantHeader}><div className={styles.aiFeatureHeader}><div><h3 id="smart-report-heading">Description check</h3><p>Pulls out the possible threat, depth, size, interactions and site landmarks. Check each one. Threat and depth here match the fields above.</p></div></div>{assistantBusy && <span className={styles.muted} role="status">Checking…</span>}</div>
          {assistantMessage && <p className={styles.assistantMessage} role="status">{assistantMessage}</p>}
          <div className={styles.inlineSuggestionGrid}>{smartReportFields.map(({ field, label }) => {
            const suggestionIndex = reportDraft.aiSuggestions.findIndex((item) => item.field === field);
            const suggestion = suggestionIndex >= 0 ? reportDraft.aiSuggestions[suggestionIndex] : undefined;
            return <label className={`${styles.inlineSuggestionField} ${suggestion?.conflict && suggestion.status === "unresolved" ? styles.conflictField : ""}`} key={field}>
              <span className={styles.inlineFieldHeading}><strong>{label}</strong><em data-state={suggestionStateLabel(suggestion).toLowerCase().replaceAll(" ", "-")}>{suggestionStateLabel(suggestion)}</em></span>
              {field === "possible_threat" ? <select
                aria-label="Possible threat type structured value"
                value={reportDraft.threatCategoryCode}
                disabled={categoryOptions.length === 0}
                onChange={(event) => {
                  const selected = categoryOptions.find((category) => category.code === event.target.value);
                  updateField({ threatCategoryCode: (selected?.code ?? "") as ReportDraft["threatCategoryCode"], threatCategoryId: selected?.threatCategoryId ?? null }, "threat");
                }}
              >
                <option value="">{categoryOptions.length === 0 ? "Loading choices…" : "Select a possible threat type"}</option>
                {categoryOptions.map((category) => <option value={category.code} key={category.code}>{category.label}</option>)}
              </select> : field === "estimated_depth_metres" ? <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                aria-label="Estimated depth structured value"
                placeholder="Not included"
                value={reportDraft.estimatedDepthMetres}
                onChange={(event) => updateField({ estimatedDepthMetres: event.target.value }, "depth")}
              /> : <input
                aria-label={label}
                placeholder="Not included"
                value={suggestion?.status === "removed" ? "" : suggestion?.suggestedValue ?? ""}
                onChange={(event) => {
                  if (suggestionIndex >= 0) updateSuggestion(suggestionIndex, { suggestedValue: event.target.value, status: event.target.value.trim() ? "corrected" : "removed" });
                  else if (event.target.value.trim()) answerFollowUp({ field, question: label, options: [] }, event.target.value);
                }}
              />}
              {suggestion?.conflict && suggestion.status === "unresolved" && <span className={styles.conflictText}>Your report already says {suggestion.observerValue}. Review this difference before submitting.</span>}
            </label>;
          })}</div>
          {followUpQuestions.length > 0 && <div className={styles.followUpSection}>
            <h4>{followUpQuestions.length} optional detail{followUpQuestions.length === 1 ? "" : "s"} could make this report more useful</h4>
            {followUpQuestions.map((question) => <fieldset key={`${question.field}-${question.question}`}>
              <legend>{question.question}</legend>
              <div className={styles.optionButtons}>{question.options.map((option) => <button type="button" key={option} onClick={() => answerFollowUp(question, option)}>{option}</button>)}</div>
            </fieldset>)}
          </div>}
          </section>
          </>}
        </section>

        <div className={styles.formFooter}>
          <div className={styles.footerStatus}>{reportDraft.lastSavedAt ? <span className={styles.savedText}>Draft saved {reportDraft.lastSavedAt}</span> : <span className={styles.muted}>Draft details stay on this device.</span>}<button className={styles.resetLink} type="button" onClick={() => { setResetError(""); setShowResetConfirmation(true); }}>Reset report</button></div>
          <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={saveDraft}>Save draft</button><button className={styles.primaryButton} type="submit">Continue to location</button></div>
        </div>
      </section>
      {showResetConfirmation && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !resettingReport) setShowResetConfirmation(false); }}>
        <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="reset-report-heading" aria-describedby="reset-report-description">
          <h2 id="reset-report-heading">Start a fresh report?</h2>
          <p id="reset-report-description">This will clear the current observation, photographs, AI-assisted fields and selected location details. This cannot be undone.</p>
          {resetError && <p className={styles.errorText} role="alert">{resetError}</p>}
          <div className={styles.dialogActions}>
            <button className={styles.secondaryButton} type="button" disabled={resettingReport} onClick={() => setShowResetConfirmation(false)}>Keep current report</button>
            <button className={styles.dangerConfirmButton} type="button" disabled={resettingReport} onClick={confirmResetReport}>{resettingReport ? "Resetting…" : "Reset report"}</button>
          </div>
        </section>
      </div>}
    </form>
  );
}

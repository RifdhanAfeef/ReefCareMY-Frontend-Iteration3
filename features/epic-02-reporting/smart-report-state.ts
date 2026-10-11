import type { SmartReportFollowUpQuestion, SmartReportSuggestion } from "@/lib/api/smartReportApi";
import type { ThreatCategoryReference } from "@/lib/api/types";
import { threatCategories } from "./threat-data";
import type { ReportAISuggestion, ReportDraft, SmartReportField, ThreatCategoryCode } from "./types";

export const smartReportFields: Array<{ field: SmartReportField; label: string }> = [
  { field: "possible_threat", label: "Possible threat type" },
  { field: "estimated_depth_metres", label: "Estimated depth" },
  { field: "approximate_size", label: "Approximate size" },
  { field: "coral_interaction", label: "Coral interaction" },
  { field: "animal_interaction", label: "Marine-animal interaction" },
  { field: "site_reference", label: "Site reference" },
];

const fieldAliases: Record<string, SmartReportField> = {
  possible_threat: "possible_threat",
  threat_category: "possible_threat",
  estimated_depth: "estimated_depth_metres",
  estimated_depth_metres: "estimated_depth_metres",
  approximate_size: "approximate_size",
  coral_interaction: "coral_interaction",
  interaction: "coral_interaction",
  animal_interaction: "animal_interaction",
  marine_animal_interaction: "animal_interaction",
  site_reference: "site_reference",
};

function normalise(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/metres?|meters?/g, "m")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normaliseSmartReportField(field: string): SmartReportField | null {
  return fieldAliases[field.trim().toLowerCase().replace(/[ -]+/g, "_")] ?? null;
}

export function observerValueFor(report: ReportDraft, field: SmartReportField) {
  if (field === "possible_threat") {
    return threatCategories.find((category) => category.code === report.threatCategoryCode)?.label ?? null;
  }
  if (field === "estimated_depth_metres") {
    return report.estimatedDepthMetres ? `${report.estimatedDepthMetres} m` : null;
  }
  const existing = report.aiSuggestions.find((suggestion) => suggestion.field === field);
  if (existing?.status === "removed") return "";
  if (existing?.status === "unresolved" && existing.conflict) return existing.observerValue;
  return existing && ["confirmed", "corrected"].includes(existing.status) ? existing.suggestedValue : null;
}

function hasObserverEntry(suggestion: ReportAISuggestion | undefined) {
  return Boolean(suggestion && (["confirmed", "corrected", "removed"].includes(suggestion.status)
    || (suggestion.status === "unresolved" && suggestion.conflict && suggestion.observerValue !== null)));
}

export function mergeSmartReportSuggestions(
  report: ReportDraft,
  incoming: SmartReportSuggestion[],
): ReportAISuggestion[] {
  const merged: ReportAISuggestion[] = incoming.flatMap((suggestion) => {
    const field = normaliseSmartReportField(suggestion.field);
    const value = suggestion.suggestedValue?.trim() || null;
    if (!field || !value || normalise(value) === "not specified") return [];

    const previous = report.aiSuggestions.find((item) => item.field === field);
    const protectedDepth = field === "estimated_depth_metres" && report.estimatedDepthSource === "observer";
    const protectedThreat = field === "possible_threat" && report.threatCategorySource === "observer";
    const protectedDetail = field !== "possible_threat" && field !== "estimated_depth_metres" && hasObserverEntry(previous);
    const observerValue = observerValueFor(report, field) ?? (protectedDepth || protectedThreat ? "" : null);
    const refreshableValue = (field === "estimated_depth_metres" && isAutomaticDepth(report) && singleDepth(value) !== null)
      || (field === "possible_threat" && isAutomaticThreat(report) && threatCodeFor(value) !== null);
    const matchesObserver = Boolean(observerValue) && normalise(observerValue) === normalise(value);
    const sameSuggestion = previous && normalise(previous.suggestedValue) === normalise(value);
    const status = refreshableValue
      ? "unresolved"
      : matchesObserver
      ? "confirmed"
      : sameSuggestion && previous.status !== "unresolved"
        ? previous.status
        : "unresolved";

    return [{
      source: "smart_report",
      field,
      label: suggestion.label || smartReportFields.find((item) => item.field === field)?.label || field,
      suggestedValue: value,
      confidence: null,
      status,
      conflict: (Boolean(observerValue) || protectedDepth || protectedThreat || protectedDetail) && !matchesObserver && !refreshableValue,
      observerValue,
    } satisfies ReportAISuggestion];
  });
  // Description analysis may omit a detail. Keep human entries, but discard old
  // automatic suggestions that are no longer supported by the description.
  for (const previous of report.aiSuggestions) {
    if (merged.some((item) => item.field === previous.field) || !hasObserverEntry(previous)) continue;
    if ((previous.field === "estimated_depth_metres" && isAutomaticDepth(report))
      || (previous.field === "possible_threat" && isAutomaticThreat(report))) continue;
    if (previous.status === "unresolved") {
      const value = previous.observerValue;
      merged.push({ ...previous, suggestedValue: value, observerValue: value,
        status: value ? "corrected" : "removed", conflict: false });
    } else merged.push(previous);
  }
  return merged;
}

function threatCodeFor(value: string | null): ThreatCategoryCode | null {
  const target = normalise(value);
  const match = threatCategories.find((category) =>
    normalise(category.label) === target || normalise(category.code) === target);
  return match?.code ?? null;
}

function singleDepth(value: string | null) {
  if (!value || /\d\s*[-–—]\s*\d/.test(value)) return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? null;
}

/** Older drafts qualify only when an unreviewed suggestion matches the field. */
function isAutomaticDepth(report: ReportDraft) {
  if (report.estimatedDepthSource) return report.estimatedDepthSource === "ai";
  const previous = report.aiSuggestions.find((item) => item.field === "estimated_depth_metres");
  const value = previous ? singleDepth(previous.suggestedValue) : null;
  return Boolean(report.estimatedDepthMetres && previous?.status === "unresolved" && !previous.conflict
    && value !== null && Number(value) === Number(report.estimatedDepthMetres));
}

/** Refresh untouched AI depth, or fill an empty field that the observer has not cleared. */
export function automaticDepthChanges(report: ReportDraft, suggestions: ReportAISuggestion[]): Partial<ReportDraft> {
  if (report.estimatedDepthSource === "observer" || (report.estimatedDepthMetres && !isAutomaticDepth(report))) return {};
  const suggestion = suggestions.find((item) => item.field === "estimated_depth_metres" && item.status === "unresolved");
  if (!suggestion && isAutomaticDepth(report)) return { estimatedDepthMetres: "", estimatedDepthSource: "ai" };
  const value = suggestion ? singleDepth(suggestion.suggestedValue) : null;
  return value !== null ? { estimatedDepthMetres: value, estimatedDepthSource: "ai" } : {};
}

/** A photo or dropdown decision always takes priority over automatic text choices. */
function isAutomaticThreat(report: ReportDraft) {
  const visual = report.visualRecognition;
  if (visual?.status === "recognized" && ["accepted", "kept", "changed"].includes(visual.resolution)) return false;
  if (report.threatCategorySource) return report.threatCategorySource === "ai";
  const previous = report.aiSuggestions.find((item) => item.field === "possible_threat");
  return Boolean(report.threatCategoryCode && previous?.status === "unresolved" && !previous.conflict
    && threatCodeFor(previous.suggestedValue) === report.threatCategoryCode);
}

export function automaticThreatChanges(
  report: ReportDraft,
  suggestions: ReportAISuggestion[],
  categoryReferences?: ThreatCategoryReference[],
): Partial<ReportDraft> {
  if (report.threatCategorySource === "observer" || (report.threatCategoryCode && !isAutomaticThreat(report))) return {};
  const suggestion = suggestions.find((item) => item.field === "possible_threat" && item.status === "unresolved");
  if (!suggestion && isAutomaticThreat(report)) return { threatCategoryCode: "", threatCategoryId: null, threatCategorySource: "ai" };
  const changes = suggestion ? applySuggestionValue(report, suggestion, categoryReferences) : {};
  return changes.threatCategoryCode ? { ...changes, threatCategorySource: "ai" } : {};
}

export function applySuggestionValue(
  report: ReportDraft,
  suggestion: ReportAISuggestion,
  categoryReferences?: ThreatCategoryReference[],
): Partial<ReportDraft> {
  if (suggestion.field === "possible_threat") {
    const code = threatCodeFor(suggestion.suggestedValue);
    const reference = categoryReferences?.find((item) => item.code === code);
    const fallback = threatCategories.find((item) => item.code === code);
    return reference
      ? { threatCategoryCode: reference.code, threatCategoryId: reference.threatCategoryId }
      : fallback
        ? { threatCategoryCode: fallback.code, threatCategoryId: fallback.id }
        : {};
  }
  if (suggestion.field === "estimated_depth_metres") {
    const depth = singleDepth(suggestion.suggestedValue);
    return depth ? { estimatedDepthMetres: depth } : {};
  }
  return {};
}

export function suggestionStateLabel(suggestion: ReportAISuggestion | undefined) {
  if (!suggestion || suggestion.status === "removed") return "Not specified";
  if (suggestion.status === "corrected") return "Entered by you";
  if (suggestion.conflict && suggestion.status === "unresolved") return "Needs checking";
  if (suggestion.status === "unresolved") return "AI suggested";
  return "AI assisted - reviewed";
}

type FollowUpTemplate = SmartReportFollowUpQuestion & { threats?: ThreatCategoryCode[] };

const predefinedFollowUps: FollowUpTemplate[] = [
  { field: "approximate_size", question: "About how large was the net or gear?", options: ["<1 m", "1-5 m", "5-10 m", ">10 m", "Unsure"], threats: ["ghost_gear"] },
  { field: "animal_interaction", question: "Did you see any marine animals trapped in or interacting with it?", options: ["Yes", "No", "Unsure"], threats: ["ghost_gear"] },
  { field: "approximate_size", question: "How much coral appeared pale or white?", options: ["Small patch", "Several colonies", "Widespread", "Unsure"], threats: ["coral_bleaching"] },
  { field: "coral_interaction", question: "Was the debris touching or caught on coral?", options: ["Yes", "No", "Unsure"], threats: ["marine_debris"] },
  { field: "approximate_size", question: "What did the damaged area look like?", options: ["Small patch", "Several metres", "Widespread", "Other / Unsure"], threats: ["physical_reef_damage"] },
];

export function contextualFollowUps(
  report: ReportDraft,
  apiQuestions: SmartReportFollowUpQuestion[],
): SmartReportFollowUpQuestion[] {
  const validApiQuestions = apiQuestions.filter((question) =>
    normaliseSmartReportField(question.field) && question.question.trim() && question.options.length > 0);
  if (validApiQuestions.length > 0) return validApiQuestions.slice(0, 2);

  const suggestedThreat = report.aiSuggestions.find((item) => item.field === "possible_threat")?.suggestedValue ?? null;
  const threat = report.threatCategoryCode || threatCodeFor(suggestedThreat) || "unsure";
  const populated = new Set(report.aiSuggestions
    .filter((item) => item.status !== "removed" && item.suggestedValue)
    .map((item) => item.field));
  return predefinedFollowUps
    .filter((item) => (!item.threats || item.threats.includes(threat)) && !populated.has(item.field as SmartReportField))
    .slice(0, 2)
    .map(({ field, question, options }) => ({ field, question, options }));
}

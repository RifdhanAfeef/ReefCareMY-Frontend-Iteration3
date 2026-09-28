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
  const existing = report.aiSuggestions.find((suggestion) =>
    suggestion.field === field && ["confirmed", "corrected"].includes(suggestion.status));
  return existing?.suggestedValue ?? null;
}

export function mergeSmartReportSuggestions(
  report: ReportDraft,
  incoming: SmartReportSuggestion[],
): ReportAISuggestion[] {
  return incoming.flatMap((suggestion) => {
    const field = normaliseSmartReportField(suggestion.field);
    const value = suggestion.suggestedValue?.trim() || null;
    if (!field || !value || normalise(value) === "not specified") return [];

    const previous = report.aiSuggestions.find((item) => item.field === field);
    const observerValue = observerValueFor(report, field);
    const matchesObserver = Boolean(observerValue) && normalise(observerValue) === normalise(value);
    const sameSuggestion = previous && normalise(previous.suggestedValue) === normalise(value);
    const status = matchesObserver
      ? "confirmed"
      : sameSuggestion && previous.status !== "unresolved"
        ? previous.status
        : "unresolved";

    return [{
      field,
      label: suggestion.label || smartReportFields.find((item) => item.field === field)?.label || field,
      suggestedValue: value,
      status,
      conflict: Boolean(observerValue) && !matchesObserver,
      observerValue,
    } satisfies ReportAISuggestion];
  });
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

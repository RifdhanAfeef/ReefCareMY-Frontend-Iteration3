import type { ReportDraft, SmartReportField } from "./types";

export type SubmittedStructuredDetails = Partial<Record<SmartReportField, string>>;

const storagePrefix = "reefcare:submitted-structured-details:";

export function saveSubmittedStructuredDetails(reportReference: string, report: ReportDraft) {
  const details: SubmittedStructuredDetails = {};
  for (const suggestion of report.aiSuggestions) {
    if (suggestion.status !== "removed" && suggestion.suggestedValue?.trim()) {
      details[suggestion.field] = suggestion.suggestedValue.trim();
    }
  }
  if (report.estimatedDepthMetres) details.estimated_depth_metres = `${report.estimatedDepthMetres} m`;
  window.localStorage.setItem(`${storagePrefix}${reportReference}`, JSON.stringify(details));
}

export function readSubmittedStructuredDetails(reportReference: string): SubmittedStructuredDetails {
  try {
    const stored = window.localStorage.getItem(`${storagePrefix}${reportReference}`);
    return stored ? JSON.parse(stored) as SubmittedStructuredDetails : {};
  } catch {
    return {};
  }
}

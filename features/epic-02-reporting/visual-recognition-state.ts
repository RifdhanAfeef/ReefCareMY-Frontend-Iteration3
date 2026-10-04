import type { VisualRecognitionResponse } from "@/lib/api/visualRecognitionApi";
import type { ReportVisualRecognition, ThreatCategoryCode } from "./types";

const supportedThreatCodes = new Set<ThreatCategoryCode>([
  "ghost_gear",
  "coral_bleaching",
  "marine_debris",
  "physical_reef_damage",
  "unsure",
]);

export function confidenceLabel(confidence: number | null) {
  if (confidence === null) return "Confidence unavailable";
  if (confidence >= 0.8) return `High confidence (${Math.round(confidence * 100)}%)`;
  if (confidence >= 0.55) return `Moderate confidence (${Math.round(confidence * 100)}%)`;
  return `Low confidence (${Math.round(confidence * 100)}%)`;
}

export function visualRecognitionDraft(
  photoId: string,
  photoName: string,
  response: VisualRecognitionResponse,
): ReportVisualRecognition {
  const code = response.suggestedThreat?.code;
  const suggestedThreatCode = code && supportedThreatCodes.has(code) ? code : null;
  return {
    photoId,
    photoName,
    status: response.status,
    suggestedThreatCode,
    suggestedThreatLabel: response.suggestedThreat?.label ?? null,
    confidence: response.confidence,
    warning: response.warning,
    resolution: response.status === "recognized" && suggestedThreatCode !== null
      ? "unresolved"
      : "not_required",
  };
}

import type { LocationDraft } from "@/features/shared/mock-app-state";
import type {
  AISuggestionState,
  LocationCheckRequest,
  LocationSource,
  ReportCompletenessRequest,
  ReportReviewRequest,
  ReportSubmissionPayload,
} from "@/lib/api/types";
import { displayDateAndTimeToIso, isValidDisplayDate } from "@/lib/format/date";
import type { ReportDraft } from "./types";

function locationSourceFor(location: LocationDraft): LocationSource {
  if (location.locationSource === "map_pin") return "manual_map_pin";
  if (location.locationSource === "manual_coordinates") return "entered_coordinates";
  return location.confidence === "unsure" ? "unknown" : "named_dive_site";
}

function pointFor(location: LocationDraft) {
  return location.pin
    ? { latitude: location.pin.latitude, longitude: location.pin.longitude }
    : null;
}

function resolvedSuggestions(report: ReportDraft): AISuggestionState[] {
  return (report.aiSuggestions ?? []).map(({ field, suggestedValue, status }) => ({ field, suggestedValue, status }));
}

function evidenceMetadata(report: ReportDraft) {
  return (report.photos ?? []).map((photo) => ({
    capturedAt: photo.capturedAtConfirmed ? (photo.capturedAt ?? null) : null,
  }));
}

function surfaceContextNotes(location: LocationDraft): string | null {
  const notes = [
    location.surfaceEntryContext.trim()
      ? `Surface entry context: ${location.surfaceEntryContext.trim()}`
      : null,
    location.surfaceExitContext.trim()
      ? `Surface exit context: ${location.surfaceExitContext.trim()}`
      : null,
  ].filter((note): note is string => Boolean(note));
  return notes.length > 0 ? notes.join("\n") : null;
}

export function buildReportCompletenessPayload(
  report: ReportDraft,
  location: LocationDraft,
  evidenceCount = report.photos.length,
): ReportCompletenessRequest {
  const session = location.sessions.find((item) => item.id === location.selectedSessionId);
  const source = locationSourceFor(location);
  const point = pointFor(location);
  const relocationNotes = surfaceContextNotes(location);
  const observedAt = report.observationDate && report.observationTime && isValidDisplayDate(report.observationDate)
    ? displayDateAndTimeToIso(report.observationDate, report.observationTime)
    : null;

  return {
    threatCategoryId: report.threatCategoryId,
    observedAt,
    estimatedDepthMetres: report.estimatedDepthMetres ? Number(report.estimatedDepthMetres) : null,
    description: report.description.trim() || null,
    diveSessionId: session?.backendId ?? null,
    location: session || location.confidence || point ? {
      namedDiveSiteId: session?.namedDiveSiteId ?? null,
      locationConfidence: location.confidence || null,
      locationSource: source,
      ...(source === "manual_map_pin" ? { mapPin: point } : {}),
      ...(source === "entered_coordinates" ? { coordinates: point } : {}),
      ...(relocationNotes ? { relocationNotes } : {}),
    } : null,
    evidenceCount,
  };
}

export function buildReportReviewPayload(
  report: ReportDraft,
  location: LocationDraft,
  evidenceCount = report.photos.length,
): ReportReviewRequest {
  return {
    ...buildReportCompletenessPayload(report, location, evidenceCount),
    evidenceMetadata: evidenceMetadata(report),
    aiSuggestions: resolvedSuggestions(report),
  };
}

export function buildLocationCheckPayload(location: LocationDraft): LocationCheckRequest | null {
  const session = location.sessions.find((item) => item.id === location.selectedSessionId);
  const source = locationSourceFor(location);
  const point = pointFor(location);
  if (!session || !point || !["manual_map_pin", "entered_coordinates"].includes(source)) return null;
  return {
    namedDiveSiteId: session.namedDiveSiteId,
    locationSource: source,
    ...(source === "manual_map_pin" ? { mapPin: point } : { coordinates: point }),
  };
}

export function buildReportSubmissionPayload(
  report: ReportDraft,
  location: LocationDraft,
): ReportSubmissionPayload {
  const session = location.sessions.find((item) => item.id === location.selectedSessionId);
  if (!Number.isInteger(report.threatCategoryId) || Number(report.threatCategoryId) <= 0 || !session?.backendId || !location.confidence) {
    throw new Error("The report needs a Dive Session, threat category and location confidence.");
  }

  const source = locationSourceFor(location);
  const point = pointFor(location);
  const relocationNotes = surfaceContextNotes(location);
  const payload: ReportSubmissionPayload = {
    threatCategoryId: Number(report.threatCategoryId),
    observedAt: displayDateAndTimeToIso(report.observationDate, report.observationTime),
    description: report.description.trim(),
    diveSessionId: session.backendId,
    location: {
      namedDiveSiteId: session.namedDiveSiteId,
      locationConfidence: location.confidence,
      locationSource: source,
      ...(source === "manual_map_pin" ? { mapPin: point } : {}),
      ...(source === "entered_coordinates" ? { coordinates: point } : {}),
      ...(relocationNotes ? { relocationNotes } : {}),
    },
    evidenceMetadata: evidenceMetadata(report),
    aiSuggestions: resolvedSuggestions(report),
  };

  if (report.estimatedDepthMetres) payload.estimatedDepthMetres = Number(report.estimatedDepthMetres);
  return payload;
}

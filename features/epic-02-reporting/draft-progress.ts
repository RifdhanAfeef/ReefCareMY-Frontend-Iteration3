import type { LocationDraft } from "@/features/shared/mock-app-state";
import type { ReportDraft } from "./types";

/**
 * True when the observer has entered anything worth protecting: observation
 * fields, photos, or progress through the location steps. Loaded dive sessions
 * alone do not count, because they come from the account, not the draft.
 */
export function hasReportInProgress(reportDraft: ReportDraft, locationDraft: LocationDraft) {
  return Boolean(
    reportDraft.threatCategoryCode
      || reportDraft.observationDate
      || reportDraft.observationTime
      || reportDraft.estimatedDepthMetres
      || reportDraft.description.trim()
      || reportDraft.photos.length > 0
      || locationDraft.step !== "session"
      || locationDraft.selectedSessionId
      || locationDraft.pin,
  );
}

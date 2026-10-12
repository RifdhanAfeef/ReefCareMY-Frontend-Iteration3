import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";

export function reportSubmissionError(error: unknown): string {
  if (!(error instanceof ApiError) || error.status !== 422) return userFacingError(error, "The report could not be submitted. Your draft is still saved.");
  const messages = error.validationIssues.flatMap((issue) => {
    const path = issue.path.join(".").replace(/_/g, "").toLowerCase();
    if (path.includes("description")) return [issue.minimumLength
      ? `Description: enter at least ${issue.minimumLength} characters.`
      : "Description: check what you observed and add any missing detail."];
    if (path.includes("photo") || path.includes("evidence")) return ["Photographs: attach your JPG, PNG or WebP images again and check each is no larger than 10 MB."];
    if (path.includes("session") || path.includes("location") || path.includes("site")) return ["Dive location: return to location and confirm your dive session, site and location confidence."];
    if (path.includes("observedat") || path.includes("date") || path.includes("time")) return ["Observation date and time: check that both are valid and are not in the future."];
    if (path.includes("depth")) return ["Estimated depth: enter a valid depth in metres, or leave it blank."];
    if (path.includes("threat") || path.includes("category")) return ["Threat type: return to observation details and select your category again."];
    if (path.includes("suggestion")) return ["AI suggestions: review any remaining suggestions, or remove them and keep your manual details."];
    return [];
  });
  return messages.length
    ? `${[...new Set(messages)].join(" ")} Your draft is still saved.`
    : "Check your observation details, dive location and photographs, then try again. Your draft is still saved.";
}

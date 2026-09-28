import { ApiError } from "./client";

export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please log in again.";
    if (error.status === 403) return "You do not have permission to complete this action.";
    if (error.status === 404) return fallback;
    if (error.status === 408) return "This is taking longer than expected. Check your internet connection and try again.";
    if (error.status === 409) return "This item has changed. Refresh the page and try again.";
    if (error.status === 422) return "Some information needs correcting before you can continue.";
    if (error.status === 429) return "Too many attempts were made. Please wait a moment and try again.";
    if (error.status >= 500) return "ReefCare MY is temporarily unavailable. Please try again shortly.";
  }

  if (error instanceof TypeError) {
    return "We couldn’t reach ReefCare MY. Check your internet connection and try again.";
  }

  return fallback;
}

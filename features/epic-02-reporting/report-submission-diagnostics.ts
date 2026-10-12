import { ApiError } from "@/lib/api/client";
import type { PreparedReportUpload } from "@/lib/api/report-photo-upload";

// The query flag affects only this review page. It is never stored in a draft.
export function reportDiagnosticsEnabled() {
  return new URLSearchParams(window.location.search).get("debugReport") === "1";
}

export function subscribeToDiagnosticMode(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function redactMessage(message: string | null, privateValues: string[]) {
  if (!message) return null;
  let redacted = message;
  // Keep validation reasons, excluding any echoed report text, filenames or coordinates.
  for (const value of privateValues.filter((value) => value.length >= 4).sort((a, b) => b.length - a.length)) {
    redacted = redacted.split(value).join("[submitted value]");
  }
  return redacted
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
    .slice(0, 2000);
}

export function buildSubmissionDiagnostic(error: unknown, context: {
  photos: File[];
  evidenceMetadataCount: number;
  elapsedMs: number;
  privateValues: string[];
  preparedUpload?: PreparedReportUpload | null;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const responseReceived = apiError?.responseReceived ?? false;
  return {
    capturedAt: new Date().toISOString(),
    request: "POST /api/v1/reports",
    httpStatus: responseReceived ? apiError?.status ?? null : null,
    responseReceived,
    errorType: error instanceof Error ? error.name : "Unknown error",
    elapsedMs: Math.round(context.elapsedMs),
    browserOnline: typeof navigator !== "undefined" ? navigator.onLine : null,
    responseSummary: {
      message: redactMessage(apiError?.serverMessage ?? null, context.privateValues),
      validationIssues: apiError?.validationIssues ?? [],
    },
    photoCount: context.photos.length,
    preparedUpload: context.preparedUpload ?? null,
    evidenceMetadataCount: context.evidenceMetadataCount,
    photos: context.photos.map((file, index) => ({
      photo: index + 1,
      sizeBytes: file.size,
      mimeType: file.type || "not supplied",
    })),
  };
}

export type SubmissionDiagnostic = ReturnType<typeof buildSubmissionDiagnostic>;

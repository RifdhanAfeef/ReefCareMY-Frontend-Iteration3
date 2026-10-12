import { expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { buildSubmissionDiagnostic } from "../report-submission-diagnostics";

const context = () => ({
  photos: [new File([new Uint8Array(58 * 1024)], "personal-photo.jpeg", { type: "image/jpeg" })],
  evidenceMetadataCount: 1,
  elapsedMs: 102.5,
  privateValues: ["personal-photo.jpeg", "My private observation", "5.90501"],
});

it("shows the server's validation reason and actual file metadata while omitting echoed private values", () => {
  const error = new ApiError("Invalid photo", 422,
    "Invalid image format: personal-photo.jpeg. My private observation at 5.90501. Bearer private-token",
    [{ path: ["body", "photos", 0], type: "value_error" }]);
  const result = buildSubmissionDiagnostic(error, context());
  expect(result).toMatchObject({
    request: "POST /api/v1/reports", httpStatus: 422, responseReceived: true,
    photoCount: 1, evidenceMetadataCount: 1,
    photos: [{ photo: 1, sizeBytes: 59392, mimeType: "image/jpeg" }],
    responseSummary: { validationIssues: [{ path: ["body", "photos", 0], type: "value_error" }] },
  });
  expect(result.responseSummary.message).toContain("Invalid image format");
  const text = JSON.stringify(result);
  for (const value of [...context().privateValues, "private-token"]) expect(text).not.toContain(value);
});

it("does not present a client timeout as an HTTP 408 response", () => {
  const error = new ApiError("Timeout", 408, null, [], false);
  expect(buildSubmissionDiagnostic(error, context())).toMatchObject({ httpStatus: null, responseReceived: false });
});

it("retains a genuine HTTP 408 response", () => {
  const error = new ApiError("Timeout", 408, "The server timed out.");
  expect(buildSubmissionDiagnostic(error, context())).toMatchObject({ httpStatus: 408, responseReceived: true });
});

it("records an unavailable response after a fetch failure without guessing a status code", () => {
  expect(buildSubmissionDiagnostic(new TypeError("Failed to fetch"), context())).toMatchObject({
    httpStatus: null, responseReceived: false, errorType: "TypeError", responseSummary: { message: null },
  });
});

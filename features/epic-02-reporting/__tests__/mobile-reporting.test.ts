import { describe, expect, it } from "vitest";
import { restoreDraftPhoto, type StoredDraftPhoto } from "../draft-storage";
import { ApiError } from "@/lib/api/client";
import { reportSubmissionError } from "../report-submission-error";

describe("mobile draft photo restoration", () => {
  it("reconstructs an uploadable File when storage returns a Blob", async () => {
    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    const restored = restoreDraftPhoto({ id: "reef.jpg-11-123", file: blob as File, name: "reef.jpg", type: "image/jpeg", lastModified: 123 });
    expect(restored.file).toBeInstanceOf(File);
    expect(restored.file.name).toBe("reef.jpg");
    expect(restored.file.type).toBe("image/jpeg");
    expect(restored.file.size).toBe(blob.size);
  });
  it("restores older saved photos without the new metadata fields", () => {
    const item = { id: "my-reef.jpg-11-123", file: new Blob(["photo"], { type: "image/jpeg" }) as File } as StoredDraftPhoto;
    expect(restoreDraftPhoto(item).file.name).toBe("my-reef.jpg");
  });
});

describe("report validation feedback", () => {
  it("names the rejected field without exposing backend details", () => {
    const error = new ApiError("Private backend detail", 422, "Private backend detail", [{ path: ["body", "payload", "description"], type: "string_too_short", minimumLength: 20 }]);
    expect(reportSubmissionError(error)).toContain("Description: enter at least 20 characters.");
    expect(reportSubmissionError(error)).not.toContain("Private backend detail");
  });
  it("provides useful next steps even without structured field errors", () => {
    expect(reportSubmissionError(new ApiError("Invalid report", 422))).toContain("Check your observation details, dive location and photographs");
  });
  it("does not claim a photo is oversized when validation identifies only the photo field", () => {
    const message = reportSubmissionError(new ApiError("Invalid photo", 422, null, [{ path: ["body", "photos", 0], type: "value_error" }]));
    expect(message).toContain("A photograph was rejected");
    expect(message).not.toContain("10 MB");
    expect(message).not.toContain("larger");
  });
  it("distinguishes capture metadata from photo-file rejection", () => {
    const message = reportSubmissionError(new ApiError("Invalid metadata", 422, null, [{ path: ["payload", "evidenceMetadata", 0, "capturedAt"], type: "datetime_parsing" }]));
    expect(message).toContain("Photo capture time");
    expect(message).not.toContain("different JPG");
  });
  it.each([new TypeError("Failed to fetch"), new ApiError("Timeout", 408), new ApiError("Server failure", 500)])("asks the observer to check for an existing report when the outcome is unknown: %s", (error) => {
    expect(reportSubmissionError(error)).toContain("Check My Reports before trying again");
  });
});

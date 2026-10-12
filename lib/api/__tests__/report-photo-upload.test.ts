import { expect, it } from "vitest";
import { prepareReportFormData, inspectReportFormData } from "../report-photo-upload";
import { restoreDraftPhoto } from "@/features/epic-02-reporting/draft-storage";
import type { ReportSubmissionPayload } from "../types";

const payload: ReportSubmissionPayload = {
  threatCategoryId: 1, observedAt: "2020-01-01T01:00:00Z", description: "Private report text",
  diveSessionId: 1, location: { namedDiveSiteId: 1, locationConfidence: "dive_site_only", locationSource: "named_dive_site" },
  evidenceMetadata: [{ capturedAt: null }], aiSuggestions: [],
};

it("includes readable restored mobile photo bytes as a photos File in the final multipart body", async () => {
  const bytes = new Uint8Array(58 * 1024);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  const photo = restoreDraftPhoto({ id: "reef.jpeg-59392-1", file: new Blob([bytes]) as File, name: "reef.jpeg", type: "", lastModified: 1 }).file;
  const formData = await prepareReportFormData(payload, [photo]);
  const uploaded = formData.get("photos") as File;
  expect(uploaded).toBeInstanceOf(File);
  expect(uploaded).not.toBe(photo);
  expect(uploaded.size).toBe(bytes.length);
  expect(uploaded.type).toBe("image/jpeg");
  expect(uploaded.name).toBe("reef.jpg");
  expect(formData.get("payload")).toBe(JSON.stringify(payload));
  expect(inspectReportFormData(formData)).toEqual({
    payloadPresent: true, photoParts: 1,
    entries: [{ field: "payload", kind: "text" }, { field: "photos", kind: "file", sizeBytes: bytes.length, mimeType: "image/jpeg" }],
  });
  expect(JSON.stringify(inspectReportFormData(formData))).not.toContain(payload.description);
});

it("blocks an empty photo list and mismatched evidence metadata before a request is built", async () => {
  await expect(prepareReportFormData(payload, [])).rejects.toThrow("No photograph is attached");
  const photo = new File(["photo"], "reef.jpg", { type: "image/jpeg" });
  await expect(prepareReportFormData({ ...payload, evidenceMetadata: [] }, [photo])).rejects.toThrow("do not match");
});

it("blocks genuine HEIC bytes even if a saved file was labelled as JPEG", async () => {
  const bytes = new Uint8Array([0, 0, 0, 24, ...Array.from("ftypheic").map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
  await expect(prepareReportFormData(payload, [new File([bytes], "reef.jpeg", { type: "image/jpeg" })])).rejects.toThrow("HEIC/HEIF");
});

it("reports an unreadable saved photo before uploading", async () => {
  const photo = new File(["photo"], "reef.jpg", { type: "image/jpeg" });
  Object.defineProperty(photo, "arrayBuffer", { value: async () => { throw new Error("File no longer available"); } });
  await expect(prepareReportFormData(payload, [photo])).rejects.toThrow("saved photograph could not be read");
});

it("uses actual JPEG bytes when an old draft retains a HEIC name and MIME type", async () => {
  const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "IMG_001.HEIC", { type: "image/heic" });
  const formData = await prepareReportFormData(payload, [photo]);
  expect(formData.get("photos")).toMatchObject({ name: "IMG_001.jpg", type: "image/jpeg", size: 4 });
});

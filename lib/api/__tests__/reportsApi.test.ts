import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyReports,
  getOpenInformationRequest,
  getReportDetail,
  getObserverEvidence,
  getReportTimeline,
  submitInformationResponse,
  submitInformationResponseWithPhotos,
  submitReport,
} from "../reportsApi";
import * as client from "../client";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 } as never);
});

describe("getMyReports", () => {
  it("calls GET /api/v1/reports/mine with no query string when no filters are given", async () => {
    await getMyReports();

    expect(mockedApiRequest.mock.calls[0][0].path).toBe("/api/v1/reports/mine");
  });

  it("encodes filters as query parameters", async () => {
    await getMyReports({ status: "needs_more_info", page: 2, pageSize: 10 });

    const { path } = mockedApiRequest.mock.calls[0][0];
    const [, query] = path.split("?");
    const params = new URLSearchParams(query);
    expect(params.get("status")).toBe("needs_more_info");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("10");
  });

  it.each([
    ["null", null],
    ["a null items collection", { items: null, page: 1, pageSize: 20, total: 0 }],
    ["an incomplete object", {}],
  ])("rejects a malformed HTTP 200 response containing %s", async (_label, payload) => {
    mockedApiRequest.mockResolvedValueOnce(payload as never);

    await expect(getMyReports()).rejects.toThrow("Invalid My Reports response.");
  });
});

describe("getReportDetail", () => {
  it("calls GET /api/v1/reports/{report_reference}", async () => {
    await getReportDetail("RC-0241");

    expect(mockedApiRequest.mock.calls[0][0].path).toBe("/api/v1/reports/RC-0241");
  });
});

describe("observer evidence", () => {
  it("requests private image bytes from the authenticated Observer route and supports cancellation", async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    vi.mocked(client.apiBlobRequest).mockResolvedValueOnce(blob);
    const controller = new AbortController();
    await expect(getObserverEvidence("RC/0241", 501, controller.signal)).resolves.toBe(blob);
    expect(client.apiBlobRequest).toHaveBeenCalledWith({
      path: "/api/v1/reports/RC%2F0241/evidence/501",
      auth: true, timeoutMs: 60_000, signal: controller.signal,
    });
  });
});

describe("getReportTimeline", () => {
  it("calls GET /api/v1/reports/{report_reference}/timeline", async () => {
    await getReportTimeline("RC-0241");

    expect(mockedApiRequest.mock.calls[0][0].path).toBe("/api/v1/reports/RC-0241/timeline");
  });
});

describe("observer information requests", () => {
  it("loads the open request for the observer's report", async () => {
    await getOpenInformationRequest("RC/0241");

    expect(mockedApiRequest.mock.calls[0][0].path)
      .toBe("/api/v1/reports/RC%2F0241/information-request");
  });

  it("submits text to the same report without creating a new report", async () => {
    await submitInformationResponse("RC-0241", { responseText: "The net was about 3 metres wide." });

    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/reports/RC-0241/information-response",
      method: "POST",
      body: { responseText: "The net was about 3 metres wide." },
    });
  });

});


describe("observer replies with photos", () => {
  it("sends text and repeated photos in one multipart request to the same report", async () => {
    const files = [new File(["first"], "wide.jpg", { type: "image/jpeg" }), new File(["second"], "close.png", { type: "image/png" })];
    await submitInformationResponseWithPhotos("RC/0241", { responseText: "Wider and closer views." }, files);
    const request = mockedApiRequest.mock.calls[0][0];
    expect(request.path).toBe("/api/v1/reports/RC%2F0241/information-response/with-photos");
    expect(request.method).toBe("POST");
    expect(request.timeoutMs).toBe(60_000);
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("responseText")).toBe("Wider and closer views.");
    expect((request.body as FormData).getAll("photos")).toEqual(files);
  });

  it("allows a text-only answer through the new multipart route", async () => {
    await submitInformationResponseWithPhotos("RC-0241", { responseText: "About three metres wide." });
    const form = mockedApiRequest.mock.calls[0][0].body as FormData;
    expect(form.get("responseText")).toBe("About three metres wide.");
    expect(form.getAll("photos")).toEqual([]);
  });
});

describe("mobile evidence upload filenames", () => {
  it("records the actual multipart entries for mobile diagnostics before posting", async () => {
    const prepared = vi.fn();
    const payload = { threatCategoryId: 1, description: "Private observation", observedAt: "2020-01-01T01:00:00Z", diveSessionId: 1, location: { namedDiveSiteId: 1, locationConfidence: "dive_site_only" as const, locationSource: "named_dive_site" as const }, evidenceMetadata: [{ capturedAt: null }], aiSuggestions: [] };
    await submitReport(payload, [new File(["jpeg-bytes"], "reef.jpg", { type: "image/jpeg" })], prepared);
    expect(prepared).toHaveBeenCalledWith(expect.objectContaining({ payloadPresent: true, photoParts: 1 }));
    expect(JSON.stringify(prepared.mock.calls)).not.toContain("Private observation");
    expect(mockedApiRequest).toHaveBeenCalledTimes(1);
  });

  it("does not send a report without a photos file", async () => {
    const payload = { threatCategoryId: 1, description: "Net on coral", observedAt: "2020-01-01T01:00:00Z", diveSessionId: 1, location: { namedDiveSiteId: 1, locationConfidence: "dive_site_only" as const, locationSource: "named_dive_site" as const }, evidenceMetadata: [], aiSuggestions: [] };
    await expect(submitReport(payload, [])).rejects.toThrow("No photograph is attached");
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("gives a JPEG converted from a camera image a JPEG filename without changing its bytes", async () => {
    const payload = { threatCategoryId: 1, description: "Net on coral", observedAt: "2020-01-01T01:00:00Z", diveSessionId: 1, location: { namedDiveSiteId: 1, locationConfidence: "dive_site_only" as const, locationSource: "named_dive_site" as const }, evidenceMetadata: [{ capturedAt: null }], aiSuggestions: [] };
    const photo = new File(["jpeg-bytes"], "IMG_001.HEIC", { type: "image/jpeg" });
    await submitReport(payload, [photo]);
    const body = mockedApiRequest.mock.calls[0][0].body as FormData;
    const uploaded = body.get("photos") as File;
    expect(uploaded.name).toBe("IMG_001.jpg");
    expect(uploaded.type).toBe("image/jpeg");
    expect(uploaded.size).toBe(photo.size);
    expect(body.get("payload")).toBe(JSON.stringify(payload));
  });
});

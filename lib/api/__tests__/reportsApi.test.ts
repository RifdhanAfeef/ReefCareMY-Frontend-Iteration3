import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMyReports,
  getOpenInformationRequest,
  getReportDetail,
  getReportTimeline,
  submitInformationResponse,
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

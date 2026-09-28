import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../client";
import { getHotspotAnalysis, getHotspotContext, getHotspotIntake, getHotspotOptions, getHotspotReports } from "../hotspotsApi";
import { filters } from "@/features/epic-05-triage/hotspots/__tests__/fixtures";

vi.mock("../client");
const request = vi.mocked(apiRequest);
beforeEach(() => { request.mockReset(); request.mockResolvedValue({}); });
describe("US5.6 API contract", () => {
  it("uses the five authenticated endpoint paths with cancellation and no cache", async () => {
    const signal = new AbortController().signal;
    await getHotspotOptions(signal);
    await getHotspotAnalysis({ ...filters, threat: "unsure" }, signal);
    await getHotspotReports(filters, 2, signal);
    await getHotspotIntake("RC/001", signal);
    await getHotspotContext("RC/001", signal);
    expect(request.mock.calls.map(([item]) => item.path)).toEqual([
      "/api/v1/coordinator/hotspots/options",
      "/api/v1/coordinator/hotspots?threat=unsure&observedFrom=2026-09-01&observedTo=2026-09-13&interval=week",
      "/api/v1/coordinator/hotspots/reports?observedFrom=2026-09-01&observedTo=2026-09-13&interval=week&page=2&pageSize=20",
      "/api/v1/coordinator/hotspots/reports/RC%2F001/intake",
      "/api/v1/coordinator/reports/RC%2F001/hotspot-context",
    ]);
    for (const [item] of request.mock.calls) {
      expect(item.signal).toBe(signal); expect(item.cache).toBe("no-store");
      expect(item.auth).not.toBe(false); expect(item.method ?? "GET").toBe("GET");
    }
  });
  it("propagates a service failure rather than replacing it with zero counts", async () => {
    request.mockRejectedValue(new Error("unavailable"));
    await expect(getHotspotAnalysis(filters)).rejects.toThrow("unavailable");
  });
});

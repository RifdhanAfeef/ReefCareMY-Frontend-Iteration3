import { describe, expect, it } from "vitest";
import { calendarDate, malaysiaTime, parseHotspotFilters, validateHotspotFilters } from "../filters";
import { hotspotQuery } from "@/lib/api/hotspotsApi";
import { hotspotLoginReturn } from "@/features/epic-01-access/login-form";
import { administratorNavigation, coordinatorNavigation, observerNavigation, publicNavigation } from "@/config/navigation";
import { filters } from "./fixtures";

describe("Hotspot date and filter semantics", () => {
  it("uses the backend default dates for a fresh page", () => expect(parseHotspotFilters("", filters)).toEqual({ filters, error: null }));
  it("round-trips the complete selection while omitting response-only timezone", () => {
    const selected = { ...filters, area: "Island & Bay", region: "Pahang", siteId: 3, threat: "unsure" as const, interval: "day" as const };
    expect(parseHotspotFilters(hotspotQuery(selected), filters)).toEqual({ filters: selected, error: null });
    expect(hotspotQuery(selected)).not.toContain("timezone");
    expect(hotspotQuery(filters)).not.toContain("threat=");
  });
  it.each(["siteId=-1", "siteId=1.5", "siteId=", "siteId=NaN", "threat=all", "interval=year", "observedFrom=2026-09-01", "timezone=UTC", "region=Pahang&region=Sabah", "observedFrom=2026-02-30&observedTo=2026-03-02"])("rejects invalid deep-link filters: %s", (query) => expect(parseHotspotFilters(query, filters).error).toBeTruthy());
  it("allows one inclusive leap year but rejects 367 days and reversed dates", () => {
    expect(validateHotspotFilters({ ...filters, observedFrom: "2024-01-01", observedTo: "2024-12-31" })).toBeNull();
    expect(validateHotspotFilters({ ...filters, observedFrom: "2024-01-01", observedTo: "2025-01-01" })).toMatch(/366/);
    expect(validateHotspotFilters({ ...filters, observedFrom: "2026-09-14" })).toMatch(/on or after/);
  });
  it("formats calendar labels without date shifts and observation instants in Malaysia", () => {
    expect(calendarDate("2026-09-01")).toBe("1 Sept 2026");
    expect(malaysiaTime("2026-08-31T16:00:00Z")).toMatch(/1 Sept 2026, 00:00/);
    expect(malaysiaTime(null)).toBe("Not available");
  });
  it("offers the independent analysis navigation only to coordinators", () => {
    expect(coordinatorNavigation.some((item) => item.href === "/coordinator/hotspots")).toBe(true);
    expect([...publicNavigation, ...observerNavigation, ...administratorNavigation].some((item) => item.href.includes("hotspots"))).toBe(false);
  });
  it("accepts hotspot login return links while rejecting external and unrelated destinations", () => {
    const origin = "https://reef.example";
    expect(hotspotLoginReturn("/coordinator/hotspots?siteId=1", origin)).toBe("/coordinator/hotspots?siteId=1");
    expect(hotspotLoginReturn("/coordinator/hotspots/reports/RC-001?siteId=1", origin)).toContain("RC-001?siteId=1");
    for (const next of ["//evil.example", "https://evil.example", "javascript:alert(1)", "/coordinator/hotspots/../../admin", "/coordinator/hotspots-evil", null]) expect(hotspotLoginReturn(next, origin)).toBeNull();
  });
});

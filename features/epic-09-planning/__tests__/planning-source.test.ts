import { beforeEach, describe, expect, it, vi } from "vitest";
import * as planningApi from "@/lib/api/planningApi";
import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";
import { sitesIn } from "../planning-data";

vi.mock("@/lib/api/planningApi");
vi.mock("@/lib/api/publicApi");

const today = "2026-10-03";
const context = { today, scenario: "normal" as const };

async function loadApiSource() {
  vi.stubEnv("NEXT_PUBLIC_E9_DATA_SOURCE", "api");
  vi.resetModules();
  const mod = await import("../planning-source");
  return mod.getPlanningSource(false);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  localStorage.clear();
});

describe("planning data source selection", () => {
  it("defaults to sample data and never leaves it in the interactive preview", async () => {
    vi.resetModules();
    const sampleMod = await import("../planning-source");
    expect(sampleMod.getPlanningSource(false).mode).toBe("sample");
    vi.stubEnv("NEXT_PUBLIC_E9_DATA_SOURCE", "api");
    vi.resetModules();
    const apiMod = await import("../planning-source");
    expect(apiMod.getPlanningSource(false).mode).toBe("api");
    expect(apiMod.getPlanningSource(true).mode).toBe("sample");
  });
});

describe("API source", () => {
  it("maps site assessments by backend dive site id and flags missing sites", async () => {
    const source = await loadApiSource();
    const [first, second] = sitesIn("Redang");
    vi.mocked(planningApi.getAreaSites).mockResolvedValue({
      areaCode: "redang",
      date: today,
      ruleVersion: "v1",
      retrievedAt: "2026-10-03T08:00:00+08:00",
      sites: [
        { diveSiteId: first.backendDiveSiteId, band: "mixed", waveHeightMaxM: 1.1, windSpeedMaxKmh: 14, reason: "r" },
      ],
    });
    const result = await source.siteAssessments("Redang", today, context);
    expect(planningApi.getAreaSites).toHaveBeenCalledWith("redang", today);
    expect(result[first.id]).toMatchObject({ band: "mixed", waves: 1.1, wind: 14, ruleVersion: "v1" });
    expect(result[second.id]).toMatchObject({ band: "unavailable", waves: null });
  });

  it("maps date summaries to the view shape", async () => {
    const source = await loadApiSource();
    vi.mocked(planningApi.getAreaDates).mockResolvedValue({
      areaCode: "tioman",
      ruleVersion: "v1",
      retrievedAt: null,
      days: [
        { date: today, band: "mixed", assessableSites: 10, totalSites: 12, breakdown: { moreFavourable: 4, mixed: 5, lessFavourable: 1 } },
      ],
    });
    const result = await source.dateSummaries("Tioman", [today, "2026-10-04"], context);
    expect(planningApi.getAreaDates).toHaveBeenCalledWith("tioman", today, "2026-10-04");
    expect(result[today]).toEqual({
      band: "mixed",
      count: 10,
      total: 12,
      breakdown: { more_favourable: 4, mixed: 5, less_favourable: 1 },
    });
  });

  it("fills months the backend did not review as unreviewed", async () => {
    const source = await loadApiSource();
    vi.mocked(planningApi.getAreaSeasonality).mockResolvedValue({
      areaCode: "perhentian",
      source: "Reviewed guide",
      basis: null,
      reviewedAt: "2026-09-01",
      months: [{ month: 1, state: "monsoon", headline: "Monsoon", detail: "Rough seas." }],
    });
    const result = await source.seasonality("Perhentian");
    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toMatchObject({ state: "monsoon", headline: "Monsoon" });
    expect(result.months[9].state).toBe("unreviewed");
    expect(result.source).toContain("Reviewed guide");
  });

  it("translates plans between front-end site ids and backend dive site ids", async () => {
    const source = await loadApiSource();
    const [site] = sitesIn("Perhentian");
    vi.mocked(planningApi.createPlan).mockImplementation(async (payload) => ({
      planId: "server-1",
      ...payload,
      updatedAt: "2026-10-03T00:00:00Z",
    }));
    const saved = await source.savePlan(
      "user-1",
      { planId: "local", name: "Trip", area: "Perhentian", plannedDate: today, siteIds: [site.id], updatedAt: "" },
      false,
    );
    expect(planningApi.createPlan).toHaveBeenCalledWith({
      name: "Trip",
      areaCode: "perhentian",
      plannedDate: today,
      diveSiteIds: [site.backendDiveSiteId],
    });
    expect(saved).toMatchObject({ planId: "server-1", area: "Perhentian", siteIds: [site.id] });
  });

  it("drops saved plans that reference unknown areas or sites", async () => {
    const source = await loadApiSource();
    vi.mocked(planningApi.listPlans).mockResolvedValue([
      { planId: "a", name: "Unknown area", areaCode: "atlantis", plannedDate: today, diveSiteIds: [1], updatedAt: "" },
      { planId: "b", name: "Unknown site", areaCode: "redang", plannedDate: today, diveSiteIds: [9999], updatedAt: "" },
      { planId: "c", name: "Good", areaCode: "redang", plannedDate: today, diveSiteIds: [reefSites.find((s) => s.island === "Redang")!.backendDiveSiteId], updatedAt: "" },
    ]);
    const plans = await source.listPlans("user-1");
    expect(plans.map((plan) => plan.planId)).toEqual(["c"]);
  });

  it("reports an unavailable brief when the backend returns no text", async () => {
    const source = await loadApiSource();
    const [site] = sitesIn("Redang");
    vi.mocked(planningApi.createPlanningBrief).mockResolvedValue({
      siteId: site.backendDiveSiteId, plannedDate: today, status: "unavailable", text: null, generatedAt: null,
    });
    const assessment = { band: "mixed" as const, waves: 1, wind: 10, reason: "", retrievedAt: "", ruleVersion: "v1" };
    expect(await source.brief(site, today, assessment, context, true)).toEqual({ status: "unavailable" });
  });
});

describe("sample source", () => {
  it("keeps plans separated per workspace in browser storage", async () => {
    vi.resetModules();
    const { getPlanningSource } = await import("../planning-source");
    const source = getPlanningSource(true);
    const [site] = sitesIn("Redang");
    const plan = { planId: "p1", name: "Trip", area: "Redang" as const, plannedDate: today, siteIds: [site.id], updatedAt: "" };
    await source.savePlan("alice", plan, false);
    expect(await source.listPlans("alice")).toHaveLength(1);
    expect(await source.listPlans("bob")).toEqual([]);
    await source.deletePlan("alice", "p1");
    expect(await source.listPlans("alice")).toEqual([]);
  });
});

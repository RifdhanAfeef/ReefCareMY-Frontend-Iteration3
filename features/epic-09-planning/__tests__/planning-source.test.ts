import { beforeEach, describe, expect, it, vi } from "vitest";
import * as planningApi from "@/lib/api/planningApi";
import * as plansApi from "@/lib/api/plansApi";
import * as publicApi from "@/lib/api/publicApi";
import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";
import { sitesIn } from "../planning-data";

vi.mock("@/lib/api/planningApi");
vi.mock("@/lib/api/plansApi");
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
      source: "Open-Meteo",
      ruleVersion: "v1",
      retrievedAt: "2026-10-03T08:00:00+08:00",
      sites: [
        { diveSiteId: first.backendDiveSiteId, band: "mixed", waveHeightMaxM: 1.1, windSpeedMaxKmh: 14, precipitationProbabilityMaxPct: 60, reason: "r" },
      ],
    });
    const result = await source.siteAssessments("Redang", today, context);
    expect(planningApi.getAreaSites).toHaveBeenCalledWith("redang", today);
    expect(result[first.id]).toMatchObject({
      band: "mixed", waves: 1.1, wind: 14, rain: 60, source: "Open-Meteo",
      retrievedAt: "2026-10-03T08:00:00+08:00", ruleVersion: "v1",
    });
    expect(result[second.id]).toMatchObject({
      band: "unavailable", waves: null, rain: null, source: null, retrievedAt: null, ruleVersion: null,
    });
  });

  it("shows the E8 public summary the brief uses, not the older activity feed (US9.4 AC2)", async () => {
    const source = await loadApiSource();
    const [site] = sitesIn("Redang");
    vi.mocked(publicApi.getPublicSiteContext).mockResolvedValue({
      diveSiteId: site.backendDiveSiteId,
      siteName: site.name,
      publicAreaLabel: "Redang",
      state: "available",
      message: "Public ReefCare context is available.",
      assessmentSummary: { acceptedObservations: 10, observationsUnderReview: 1 },
      threats: [
        { threatCategoryCode: "marine_debris", threatCategoryLabel: "Marine debris", acceptedReportCount: 7, mostRecentMonth: "2026-09" },
      ],
      activity: [
        { activityId: null, activityType: "cleanup", title: "Reef clean-up", summary: "Debris removed.", activityDate: "2026-09-20", sourceLabel: "ReefCare" },
      ],
      interpretationNote: "Counts reflect ReefCare records only.",
    } as Awaited<ReturnType<typeof publicApi.getPublicSiteContext>>);

    const view = await source.publicContext(site, context);

    expect(publicApi.getPublicSiteContext).toHaveBeenCalledWith(site.backendDiveSiteId);
    expect(publicApi.getPublicSiteActivity).not.toHaveBeenCalled();
    expect(view.available).toBe(true);
    expect(view.headline).toBe("10 accepted observations · 1 observation under review");
    expect(view.items).toEqual([
      { title: "Marine debris", summary: "7 accepted reports", meta: "most recent 2026-09" },
      { title: "Reef clean-up", summary: "Debris removed.", meta: "2026-09-20 · ReefCare" },
    ]);
    expect(view.note).toBe("Counts reflect ReefCare records only.");
  });

  it("passes on the E8 message when a site has no public context", async () => {
    const source = await loadApiSource();
    const [site] = sitesIn("Redang");
    vi.mocked(publicApi.getPublicSiteContext).mockResolvedValue({
      diveSiteId: site.backendDiveSiteId,
      siteName: site.name,
      publicAreaLabel: "Redang",
      state: "no_public_context",
      message: "No public ReefCare context is available. This does not mean there are no reef threats.",
      assessmentSummary: { acceptedObservations: 0, observationsUnderReview: 0 },
      threats: [],
      activity: [],
      interpretationNote: "Counts reflect ReefCare records only.",
    });

    const view = await source.publicContext(site, context);

    expect(view).toEqual({
      available: false,
      headline: null,
      items: [],
      note: "No public ReefCare context is available. This does not mean there are no reef threats.",
    });
  });

  it("maps date summaries to the view shape", async () => {
    const source = await loadApiSource();
    vi.mocked(planningApi.getAreaDates).mockResolvedValue({
      areaCode: "tioman",
      ruleVersion: "v1",
      retrievedAt: null,
      days: [
        { date: today, band: "mixed", assessableSites: 10, totalSites: 12, breakdown: { moreFavourable: 4, mixed: 5, lessFavourable: 1 }, signals: { waveHeightMaxM: 1, windSpeedMaxKmh: 14, precipitationProbabilityMaxPct: 30 }, reasons: ["Least favourable site sets the band."] },
      ],
    });
    const result = await source.dateSummaries("Tioman", [today, "2026-10-04"], context);
    expect(planningApi.getAreaDates).toHaveBeenCalledWith("tioman", today, "2026-10-04");
    expect(result[today]).toEqual({
      band: "mixed",
      count: 10,
      total: 12,
      breakdown: { more_favourable: 4, mixed: 5, less_favourable: 1 },
      signals: { waves: 1, wind: 14, rain: 30 },
      reasons: ["Least favourable site sets the band."],
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
    vi.mocked(plansApi.createPlan).mockImplementation(async (body) => ({
      planId: 1,
      ...body,
      createdAt: "2026-10-03T00:00:00Z",
      updatedAt: "2026-10-03T00:00:00Z",
    }));
    const saved = await source.savePlan(
      "user-1",
      { planId: "local", name: " Trip ", area: "Perhentian", plannedDate: today, siteIds: [site.id], updatedAt: "" },
      false,
    );
    expect(plansApi.createPlan).toHaveBeenCalledWith({
      name: "Trip",
      areaCode: "perhentian",
      plannedDate: today,
      diveSiteIds: [site.backendDiveSiteId],
    });
    expect(saved).toMatchObject({ planId: "1", area: "Perhentian", siteIds: [site.id] });
  });

  it("keeps valid saved plans when another plan references an unknown area or site", async () => {
    const source = await loadApiSource();
    const stamp = { createdAt: "", updatedAt: "" };
    vi.mocked(plansApi.listPlans).mockResolvedValue({
      items: [
        { planId: 1, name: "Unknown area", areaCode: "atlantis", plannedDate: today, diveSiteIds: [1], ...stamp },
        { planId: 2, name: "Unknown site", areaCode: "redang", plannedDate: today, diveSiteIds: [9999], ...stamp },
        { planId: 3, name: "Good", areaCode: "redang", plannedDate: today, diveSiteIds: [reefSites.find((s) => s.island === "Redang")!.backendDiveSiteId], ...stamp },
      ],
    });
    const plans = await source.listPlans("user-1");
    expect(plans.map((plan) => plan.planId)).toEqual(["3"]);
  });

  it("reloads the saved intent from the server when a plan is reopened", async () => {
    const source = await loadApiSource();
    const redang = reefSites.find((s) => s.island === "Redang")!;
    vi.mocked(plansApi.getPlan).mockResolvedValue({
      planId: 12, name: "Renamed elsewhere", areaCode: "redang", plannedDate: today,
      diveSiteIds: [redang.backendDiveSiteId], createdAt: "", updatedAt: "",
    });
    const loaded = await source.loadPlan("user-1", {
      planId: "12", name: "Old name", area: "Redang", plannedDate: today, siteIds: [], updatedAt: "",
    });
    expect(plansApi.getPlan).toHaveBeenCalledWith(12);
    expect(loaded).toMatchObject({ planId: "12", name: "Renamed elsewhere", siteIds: [redang.id] });
  });

  it("reports an unavailable brief when the backend returns no text", async () => {
    const source = await loadApiSource();
    const [site] = sitesIn("Redang");
    vi.mocked(planningApi.createPlanningBrief).mockResolvedValue({
      siteId: site.backendDiveSiteId, plannedDate: today, status: "unavailable", text: null, generatedAt: null,
    });
    const assessment = { band: "mixed" as const, waves: 1, wind: 10, rain: null, reason: "", source: null, retrievedAt: null, ruleVersion: "v1" };
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

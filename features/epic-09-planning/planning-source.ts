import {
  createPlan,
  createPlanningBrief,
  deletePlan,
  getAreaDates,
  getAreaSeasonality,
  getAreaSites,
  listPlans,
  updatePlan,
  type PlanDto,
  type SeasonState,
} from "@/lib/api/planningApi";
import { getPublicSiteActivity } from "@/lib/api/publicApi";
import type { ReefSite } from "@/features/epic-02-reef-explorer/types";
import {
  areas,
  assess,
  daySummary,
  labels,
  readPlans,
  sitesIn,
  writePlans,
  type Area,
  type Assessment,
  type Band,
  type Plan,
  type Scenario,
} from "./planning-data";

// "sample" keeps the offline prototype data. "api" calls the backend routes in planningApi.ts.
// The interactive preview (?preview=1) always uses sample data so its demo states keep working.
export type PlanningMode = "sample" | "api";

export type PlanningContext = { today: string; scenario: Scenario };

export type SeasonMonthView = { state: SeasonState; headline: string; detail: string };
export type SeasonView = { source: string; months: SeasonMonthView[] };

export type DaySummaryView = {
  band: Band;
  count: number;
  total: number;
  breakdown: { more_favourable: number; mixed: number; less_favourable: number };
};

export type ContextItemView = { title: string; summary: string; meta: string | null };
export type ContextView = {
  available: boolean;
  headline: string | null;
  items: ContextItemView[];
  note: string;
};

export type BriefView =
  | { status: "generated"; paragraphs: string[]; footnote: string }
  | { status: "unavailable" };

export type PlanningSource = {
  mode: PlanningMode;
  seasonality(area: Area): Promise<SeasonView>;
  dateSummaries(area: Area, dates: string[], context: PlanningContext): Promise<Record<string, DaySummaryView>>;
  siteAssessments(area: Area, date: string, context: PlanningContext): Promise<Record<string, Assessment>>;
  publicContext(site: ReefSite, context: PlanningContext): Promise<ContextView>;
  brief(site: ReefSite, date: string, assessment: Assessment, context: PlanningContext, contextAvailable: boolean): Promise<BriefView>;
  listPlans(owner: string): Promise<Plan[]>;
  savePlan(owner: string, plan: Plan, exists: boolean): Promise<Plan>;
  deletePlan(owner: string, planId: string): Promise<void>;
};

export const FORECAST_HORIZON_DAYS = 6;

const API_MODE_ENABLED = process.env.NEXT_PUBLIC_E9_DATA_SOURCE === "api";

export function planningModeFor(previewMode: boolean): PlanningMode {
  return !previewMode && API_MODE_ENABLED ? "api" : "sample";
}

export function areaCodeFor(area: Area): string {
  return area.toLowerCase();
}

function areaFromCode(code: string): Area | null {
  return areas.find((area) => areaCodeFor(area) === code.toLowerCase()) ?? null;
}

export function unavailableAssessment(reason: string): Assessment {
  return { band: "unavailable", waves: null, wind: null, reason, retrievedAt: "unknown", ruleVersion: "unknown" };
}

// ---------------------------------------------------------------------------------------------
// Sample source: the existing deterministic prototype fixtures.
// ---------------------------------------------------------------------------------------------

const SAMPLE_MONTH_STATES: SeasonState[] = [
  "monsoon", "monsoon", "transition", "typical", "typical", "typical",
  "typical", "typical", "transition", "unreviewed", "monsoon", "monsoon",
];

const SEASON_COPY: Record<SeasonState, { headline: string; detail: string }> = {
  unreviewed: {
    headline: "Reviewed guidance unavailable",
    detail:
      "This prototype demonstrates a month without reviewed guidance. No seasonal pattern is inferred.",
  },
  monsoon: {
    headline: "Northeast monsoon reference",
    detail:
      "The sample calendar illustrates potentially rougher seas and changing operator schedules. Seasonal patterns do not predict conditions on a particular date.",
  },
  transition: {
    headline: "A changing season",
    detail:
      "This illustrative seasonal entry is reference information, not a forecast. Confirm current conditions and access with local operators and authorities.",
  },
  typical: {
    headline: "Generally more favourable seasonal pattern",
    detail:
      "This illustrative seasonal entry is reference information, not a forecast. Confirm current conditions and access with local operators and authorities.",
  },
};

const sampleSource: PlanningSource = {
  mode: "sample",
  async seasonality() {
    return {
      source:
        "Source: synthetic seasonal reference for prototype review · Basis: example east-coast seasonal pattern · Fixture reviewed 27 Sep 2026 · Not a live feed or operational advice.",
      months: SAMPLE_MONTH_STATES.map((state) => ({ state, ...SEASON_COPY[state] })),
    };
  },
  async dateSummaries(area, dates, { today, scenario }) {
    return Object.fromEntries(dates.map((date) => [date, daySummary(date, area, today, scenario)]));
  },
  async siteAssessments(area, date, { today, scenario }) {
    return Object.fromEntries(
      sitesIn(area).map((site, index) => [site.id, assess(date, area, today, scenario, index)]),
    );
  },
  async publicContext(_site, { today, scenario }) {
    if (scenario === "context") {
      return {
        available: false,
        headline: null,
        items: [],
        note: "No public ReefCare context is currently available. This does not mean there are no reef threats.",
      };
    }
    return {
      available: true,
      headline:
        "3 assessed observations in the example 30-day window: 2 marine debris and 1 coral bleaching. Assessment state: evidence accepted, not field verification.",
      items: [
        {
          title: "Monitoring update",
          summary: `1 publishable monitoring update dated ${today}. These are fictional demonstration records, not actual activity at this site.`,
          meta: null,
        },
      ],
      note: "Generalised public summary. Private reports, identities and precise report locations are excluded.",
    };
  },
  async brief(site, _date, assessment, { scenario }, contextAvailable) {
    if (scenario === "ai") return { status: "unavailable" };
    return {
      status: "generated",
      paragraphs: [
        `The sample forecast for ${site.name} shows ${assessment.waves} m wave height and ${assessment.wind} km/h wind, giving ${labels[assessment.band].toLowerCase()} forecast conditions under the illustrative rule.`,
        contextAvailable
          ? "The sample reef context includes assessed debris and bleaching observations. Familiarise yourself with these threats, keep your equipment clear of coral and observe without disturbing the reef."
          : "Public ReefCare context is unavailable; no conclusion about reef threats can be drawn.",
        "Confirm the day’s conditions, site access and your experience requirements with a local operator. This brief does not determine whether a dive should proceed.",
      ],
      footnote: "Sample text generated from local fixtures · Not a connected AI service",
    };
  },
  async listPlans(owner) {
    return readPlans(owner);
  },
  async savePlan(owner, plan) {
    const current = readPlans(owner);
    writePlans(owner, [plan, ...current.filter((item) => item.planId !== plan.planId)]);
    return plan;
  },
  async deletePlan(owner, planId) {
    writePlans(owner, readPlans(owner).filter((item) => item.planId !== planId));
  },
};

// ---------------------------------------------------------------------------------------------
// API source: the backend routes proposed in the Epic 9 contract.
// ---------------------------------------------------------------------------------------------

function planFromDto(dto: PlanDto): Plan | null {
  const area = areaFromCode(dto.areaCode);
  if (!area) return null;
  const known = sitesIn(area);
  const siteIds = dto.diveSiteIds.flatMap((id) => {
    const site = known.find((item) => item.backendDiveSiteId === id);
    return site ? [site.id] : [];
  });
  if (!siteIds.length) return null;
  return { planId: dto.planId, name: dto.name, area, plannedDate: dto.plannedDate, siteIds, updatedAt: dto.updatedAt };
}

function planWriteFor(plan: Plan) {
  const known = sitesIn(plan.area);
  return {
    name: plan.name,
    areaCode: areaCodeFor(plan.area),
    plannedDate: plan.plannedDate,
    diveSiteIds: plan.siteIds.flatMap((id) => {
      const site = known.find((item) => item.id === id);
      return site ? [site.backendDiveSiteId] : [];
    }),
  };
}

const apiSource: PlanningSource = {
  mode: "api",
  async seasonality(area) {
    const dto = await getAreaSeasonality(areaCodeFor(area));
    const months: SeasonMonthView[] = Array.from({ length: 12 }, (_, index) => {
      const entry = dto.months.find((item) => item.month === index + 1);
      const state = entry?.state ?? "unreviewed";
      return {
        state,
        headline: entry?.headline ?? SEASON_COPY[state].headline,
        detail:
          entry?.detail ??
          (state === "unreviewed"
            ? "Reviewed seasonal guidance is not available for this month. No seasonal pattern is inferred."
            : SEASON_COPY[state].detail),
      };
    });
    const parts = [
      dto.source ? `Source: ${dto.source}` : null,
      dto.basis ? `Basis: ${dto.basis}` : null,
      dto.reviewedAt ? `Reviewed ${dto.reviewedAt}` : null,
      "Seasonal reference, not a forecast or operational advice.",
    ].filter(Boolean);
    return { source: parts.join(" · "), months };
  },
  async dateSummaries(area, dates) {
    const dto = await getAreaDates(areaCodeFor(area), dates[0], dates[dates.length - 1]);
    return Object.fromEntries(
      dto.days.map((day) => [
        day.date,
        {
          band: day.band,
          count: day.assessableSites,
          total: day.totalSites,
          breakdown: {
            more_favourable: day.breakdown.moreFavourable,
            mixed: day.breakdown.mixed,
            less_favourable: day.breakdown.lessFavourable,
          },
        },
      ]),
    );
  },
  async siteAssessments(area, date) {
    const dto = await getAreaSites(areaCodeFor(area), date);
    const byBackendId = new Map(dto.sites.map((site) => [site.diveSiteId, site]));
    return Object.fromEntries(
      sitesIn(area).map((site) => {
        const found = byBackendId.get(site.backendDiveSiteId);
        const assessment: Assessment = found
          ? {
              band: found.band,
              waves: found.waveHeightMaxM,
              wind: found.windSpeedMaxKmh,
              reason: found.reason,
              retrievedAt: dto.retrievedAt ?? "unknown",
              ruleVersion: dto.ruleVersion,
            }
          : unavailableAssessment("No assessment is available for this site.");
        return [site.id, assessment];
      }),
    );
  },
  async publicContext(site) {
    const activity = await getPublicSiteActivity(site.backendDiveSiteId);
    return {
      available: activity.hasActivity,
      headline: null,
      items: activity.items.map((item) => ({
        title: item.title,
        summary: item.summary,
        meta: [item.activityDate, item.sourceLabel].filter(Boolean).join(" · ") || null,
      })),
      note: activity.message,
    };
  },
  async brief(site, date) {
    const dto = await createPlanningBrief(site.backendDiveSiteId, date);
    if (dto.status !== "generated" || !dto.text) return { status: "unavailable" };
    return {
      status: "generated",
      paragraphs: dto.text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
      footnote: "AI-generated from the facts above · Confirm conditions with a local operator",
    };
  },
  async listPlans() {
    const dtos = await listPlans();
    return dtos.flatMap((dto) => {
      const plan = planFromDto(dto);
      return plan ? [plan] : [];
    });
  },
  async savePlan(_owner, plan, exists) {
    const payload = planWriteFor(plan);
    const dto = exists ? await updatePlan(plan.planId, payload) : await createPlan(payload);
    const saved = planFromDto(dto);
    if (!saved) throw new Error("The saved plan could not be read back.");
    return saved;
  },
  async deletePlan(_owner, planId) {
    await deletePlan(planId);
  },
};

export function getPlanningSource(previewMode: boolean): PlanningSource {
  return planningModeFor(previewMode) === "api" ? apiSource : sampleSource;
}

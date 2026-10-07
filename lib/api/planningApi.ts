import { apiRequest } from "./client";

// Epic 9 public planning contracts, frozen with the backend owner on 4 Oct 2026
// (see docs/iteration-3/e9-api-contract.md). Saved-plan CRUD lives in plansApi.ts.
// Keep any reshaping out of the UI: planning-source.ts maps these responses to view shapes.

export type PlanningBand =
  | "more_favourable"
  | "mixed"
  | "less_favourable"
  | "unavailable"
  | "not_assessable"
  | "out_of_horizon";

export type SeasonState = "monsoon" | "transition" | "typical" | "unreviewed";

export type SeasonalityMonthDto = {
  month: number;
  state: SeasonState;
  headline: string | null;
  detail: string | null;
};

export type SeasonalityDto = {
  areaCode: string;
  source: string | null;
  basis: string | null;
  reviewedAt: string | null;
  months: SeasonalityMonthDto[];
};

// One aggregated object per date. Per-site values come from the /sites endpoint.
export type DateSignalsDto = {
  waveHeightMaxM: number | null;
  windSpeedMaxKmh: number | null;
  precipitationProbabilityMaxPct: number | null;
};

export type DateSummaryDto = {
  date: string;
  band: PlanningBand;
  assessableSites: number;
  totalSites: number;
  breakdown: { moreFavourable: number; mixed: number; lessFavourable: number };
  signals: DateSignalsDto | null;
  reasons: string[];
};

export type AreaDatesDto = {
  areaCode: string;
  source?: string | null;
  ruleVersion: string;
  retrievedAt: string | null;
  days: DateSummaryDto[];
};

export type SiteAssessmentDto = {
  diveSiteId: number;
  siteName?: string;
  band: PlanningBand;
  waveHeightMaxM: number | null;
  windSpeedMaxKmh: number | null;
  precipitationProbabilityMaxPct?: number | null;
  reason: string;
};

export type AreaSitesDto = {
  areaCode: string;
  date: string;
  source?: string | null;
  ruleVersion: string;
  retrievedAt: string | null;
  sites: SiteAssessmentDto[];
};

export type PlanningBriefDto = {
  siteId: number;
  plannedDate: string;
  status: "generated" | "unavailable";
  text: string | null;
  generatedAt: string | null;
};

const PLANNING_BASE = "/api/v1/public/planning/areas";

export function getAreaSeasonality(areaCode: string, signal?: AbortSignal): Promise<SeasonalityDto> {
  return apiRequest<SeasonalityDto>({
    path: `${PLANNING_BASE}/${encodeURIComponent(areaCode)}/seasonality`,
    auth: false,
    signal,
  });
}

export function getAreaDates(
  areaCode: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AreaDatesDto> {
  const query = new URLSearchParams({ from, to });
  return apiRequest<AreaDatesDto>({
    path: `${PLANNING_BASE}/${encodeURIComponent(areaCode)}/dates?${query.toString()}`,
    auth: false,
    signal,
  });
}

export function getAreaSites(areaCode: string, date: string, signal?: AbortSignal): Promise<AreaSitesDto> {
  const query = new URLSearchParams({ date });
  return apiRequest<AreaSitesDto>({
    path: `${PLANNING_BASE}/${encodeURIComponent(areaCode)}/sites?${query.toString()}`,
    auth: false,
    signal,
  });
}

// The backend assembles the brief's facts itself, so only the site and date are sent.
export function createPlanningBrief(
  siteId: number,
  plannedDate: string,
  signal?: AbortSignal,
): Promise<PlanningBriefDto> {
  return apiRequest<PlanningBriefDto>({
    path: "/api/v1/public/planning/brief",
    method: "POST",
    body: { siteId, plannedDate },
    // Allow forecast retrieval and the backend's 21s default AI fallback,
    // plus database/network overhead, before giving up on the optional brief.
    timeoutMs: 60_000,
    auth: false,
    signal,
  });
}

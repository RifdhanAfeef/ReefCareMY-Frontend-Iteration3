import { apiRequest } from "./client";

export type PlanningBand =
  | "more_favourable"
  | "mixed"
  | "less_favourable"
  | "unavailable"
  | "out_of_horizon";

export type PlanningDay = {
  date: string;
  band: PlanningBand;
  assessableSites: number;
  totalSites: number;
  breakdown: {
    moreFavourable: number;
    mixed: number;
    lessFavourable: number;
  };
  reasons: string[];
};

export type DateComparisonResponse = {
  areaCode: string;
  ruleVersion: string;
  source: string;
  retrievedAt: string;
  days: PlanningDay[];
};

export type PlanningSite = {
  diveSiteId: number;
  siteName: string;
  band: PlanningBand;
  waveHeightMaxM: number | null;
  windSpeedMaxKmh: number | null;
  precipitationProbabilityMaxPct: number | null;
  reason: string;
};

export type SiteComparisonResponse = {
  areaCode: string;
  date: string;
  ruleVersion: string;
  source: string;
  retrievedAt: string;
  sites: PlanningSite[];
};

export function getPlanningDates(areaCode: string, from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return apiRequest<DateComparisonResponse>({
    path: `/api/v1/public/planning/areas/${encodeURIComponent(areaCode)}/dates?${query}`,
    auth: false,
  });
}

export function getPlanningSites(areaCode: string, date: string) {
  const query = new URLSearchParams({ date });
  return apiRequest<SiteComparisonResponse>({
    path: `/api/v1/public/planning/areas/${encodeURIComponent(areaCode)}/sites?${query}`,
    auth: false,
  });
}

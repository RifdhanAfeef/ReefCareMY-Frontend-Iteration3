/** US5.6 camelCase contracts from the accompanying FastAPI implementation. */
export type HotspotThreat = "ghost_gear" | "coral_bleaching" | "marine_debris" | "physical_damage" | "unsure";
export type HotspotInterval = "day" | "week" | "month";
export type HotspotState = "ready" | "no_matches" | "insufficient_data" | "unavailable";

export type HotspotFilters = {
  siteId: number | null;
  area: string | null;
  region: string | null;
  threat: HotspotThreat | null;
  observedFrom: string;
  observedTo: string;
  interval: HotspotInterval;
  timezone: "Asia/Kuala_Lumpur";
};

export type HotspotSite = { siteId: number; name: string; area: string | null; region: string | null };
export type ThreatOption = { code: string; label: string };
export type ThreatCount = ThreatOption & { reportCount: number };
export type FrequencyBucket = {
  bucketStart: string;
  bucketEndExclusive: string;
  includedFrom: string;
  includedTo: string;
  isPartial: boolean;
  reportCount: number;
};
export type HotspotSummary = {
  reportCount: number;
  threatBreakdown: ThreatCount[];
  frequency: FrequencyBucket[];
  trendState: "available" | "insufficient_history";
  trendMessage: string;
};
export type HotspotSiteSummary = HotspotSummary & {
  site: HotspotSite;
  mapLocation: { latitude: number; longitude: number; uncertaintyMetres: number; basis: string } | null;
};
export type HotspotMetadata = {
  countBasis: string;
  locationBasis: string;
  selectionBasis: string;
  timeBasis: string;
  interpretation: string;
};
export type HotspotAnalysis = {
  state: HotspotState;
  message: string;
  filters: HotspotFilters;
  lastSuccessfulUpdateAt: string | null;
  metadata: HotspotMetadata;
  summary: HotspotSummary | null;
  sites: HotspotSiteSummary[];
  dataQuality: {
    matchingReportCount: number;
    includedReportCount: number;
    excludedMissingSiteCount: number;
    undatedReportCount: number;
    mappedReportCount: number;
    unmappedReportCount: number;
  } | null;
  mapState: "ready" | "partial" | "no_matches" | "insufficient_data" | "unavailable";
  mapMessage: string;
};
export type HotspotOptions = {
  state: "ready" | "unavailable";
  message: string;
  sites: HotspotSite[];
  threats: ThreatOption[];
  intervals: string[];
  defaultFilters: HotspotFilters;
  maxPeriodDays: number;
};
export type HotspotIntakeItem = {
  reportReference: string;
  site: HotspotSite | null;
  threat: string;
  threatCode: string;
  observedAt: string | null;
  submittedAt: string;
  statusCode: string;
  statusLabel: string;
  isClosed: boolean;
  ownership: "unclaimed" | "mine" | "other";
  ownerDisplayName: string | null;
  nextAction: "claim" | "review" | "assigned_summary" | "restricted_summary";
  claimApiPath: string | null;
  reviewApiPath: string | null;
};
export type HotspotReports = {
  state: "ready" | "no_matches" | "unavailable";
  message: string;
  filters: HotspotFilters;
  items: HotspotIntakeItem[];
  total: number | null;
  page: number;
  pageSize: number;
};
export type HotspotContext = {
  state: HotspotState;
  message: string;
  reportReference: string;
  site: HotspotSite | null;
  filters: HotspotFilters | null;
  reportCount: number | null;
  lastSuccessfulUpdateAt: string | null;
  analysisApiPath: string | null;
  analysisQuery: string | null;
  metadata: HotspotMetadata;
};

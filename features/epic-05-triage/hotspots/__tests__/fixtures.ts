import type { HotspotAnalysis, HotspotContext, HotspotFilters, HotspotIntakeItem, HotspotOptions, HotspotReports, HotspotSummary } from "@/lib/api/hotspot-types";

// Synthetic test data only. These coordinates are never imported by production code.
export const filters: HotspotFilters = { siteId: null, area: null, region: null, threat: null, observedFrom: "2026-09-01", observedTo: "2026-09-13", interval: "week", timezone: "Asia/Kuala_Lumpur" };
export const sites = [
  { siteId: 1, name: "Test Reef North", area: "Test Island", region: "Pahang" },
  { siteId: 2, name: "Test Reef South", area: "Test Island", region: "Pahang" },
  { siteId: 3, name: "Test Reef East", area: "Test Bay", region: "Sabah" },
];
export const threats = [
  { code: "ghost_gear", label: "Ghost fishing gear" }, { code: "coral_bleaching", label: "Coral bleaching" },
  { code: "marine_debris", label: "Marine debris" }, { code: "physical_damage", label: "Physical reef damage" }, { code: "unsure", label: "Unsure" },
];
export const options: HotspotOptions = { state: "ready", message: "Ready", sites, threats, intervals: ["day", "week", "month"], defaultFilters: filters, maxPeriodDays: 366 };
export const summary: HotspotSummary = {
  reportCount: 12, threatBreakdown: threats.map((threat, i) => ({ ...threat, reportCount: [5, 3, 2, 1, 1][i] })),
  frequency: [
    { bucketStart: "2026-08-31", bucketEndExclusive: "2026-09-07", includedFrom: "2026-09-01", includedTo: "2026-09-06", isPartial: true, reportCount: 5 },
    { bucketStart: "2026-09-07", bucketEndExclusive: "2026-09-14", includedFrom: "2026-09-07", includedTo: "2026-09-13", isPartial: false, reportCount: 7 },
  ], trendState: "available", trendMessage: "Reporting frequency is available.",
};
export const analysis: HotspotAnalysis = {
  state: "ready", message: "Ready", filters, summary,
  lastSuccessfulUpdateAt: "2026-09-13T09:00:00Z",
  sites: sites.slice(0, 2).map((site, i) => ({ ...summary, site, reportCount: i ? 4 : 8, mapLocation: null,
    threatBreakdown: summary.threatBreakdown.map((threat, t) => ({ ...threat, reportCount: (i ? [1, 1, 1, 1, 0] : [4, 2, 1, 0, 1])[t] })),
    frequency: summary.frequency.map((bucket, b) => ({ ...bucket, reportCount: (i ? [2, 2] : [3, 5])[b] })),
  })),
  dataQuality: { matchingReportCount: 13, includedReportCount: 12, excludedMissingSiteCount: 1, undatedReportCount: 2, mappedReportCount: 0, unmappedReportCount: 12 },
  mapState: "insufficient_data", mapMessage: "Approved generalised map locations are not available. Named-site summaries remain available.",
  metadata: { countBasis: "Individual submitted reports, not distinct or confirmed incidents.", locationBasis: "Named dive site linked through each report's dive session.", selectionBasis: "Exact named-site and area membership; no radius calculation.", timeBasis: "Observation dates in Asia/Kuala_Lumpur, inclusive. Submission time is not substituted.", interpretation: "Reporting frequency does not establish ecological risk, severity, safety, absence of threats or field verification." },
};
export const mappedAnalysis: HotspotAnalysis = {
  ...analysis, mapState: "ready", mapMessage: "All reports have an approved generalised site anchor.",
  dataQuality: { ...analysis.dataQuality!, mappedReportCount: 12, unmappedReportCount: 0 },
  sites: analysis.sites.map((site, i) => ({ ...site, mapLocation: { latitude: 2.82 + i * .04, longitude: 104.14 + i * .06, uncertaintyMetres: 2000, basis: "Synthetic test anchor; not a real incident position." } })),
};
export const emptyAnalysis: HotspotAnalysis = {
  ...analysis, state: "no_matches", message: "No reports match these dates and filters.", sites: [], mapState: "no_matches", mapMessage: "No matching reports to show on the map.",
  summary: { ...summary, reportCount: 0, threatBreakdown: summary.threatBreakdown.map((item) => ({ ...item, reportCount: 0 })), frequency: summary.frequency.map((item) => ({ ...item, reportCount: 0 })), trendState: "insufficient_history", trendMessage: "There is insufficient history to show a trend." },
  dataQuality: { matchingReportCount: 0, includedReportCount: 0, excludedMissingSiteCount: 0, undatedReportCount: 0, mappedReportCount: 0, unmappedReportCount: 0 },
};
export const intake: HotspotIntakeItem = {
  reportReference: "RC-TEST-001", site: sites[0], threat: "Ghost fishing gear", threatCode: "ghost_gear", observedAt: "2026-09-12T02:00:00Z", submittedAt: "2026-09-12T03:00:00Z", statusCode: "submitted", statusLabel: "Submitted", isClosed: false, ownership: "unclaimed", ownerDisplayName: null, nextAction: "claim", claimApiPath: "/api/v1/coordinator/reports/RC-TEST-001/claim", reviewApiPath: null,
};
export const assignedIntake: HotspotIntakeItem = { ...intake, ownership: "other", ownerDisplayName: "Other Coordinator", nextAction: "assigned_summary", claimApiPath: null };
export const reports: HotspotReports = { state: "ready", message: "Ready", filters, items: [intake, { ...assignedIntake, reportReference: "RC-TEST-002" }], total: 12, page: 1, pageSize: 20 };
export const context: HotspotContext = { state: "ready", message: "Ready", reportReference: intake.reportReference, site: sites[0], filters: { ...filters, siteId: 1 }, reportCount: 8, lastSuccessfulUpdateAt: analysis.lastSuccessfulUpdateAt, analysisApiPath: "/api/v1/coordinator/hotspots", analysisQuery: "siteId=1&observedFrom=2026-09-01&observedTo=2026-09-13&interval=week", metadata: analysis.metadata };

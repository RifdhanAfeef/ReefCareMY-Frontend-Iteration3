import { apiRequest } from "./client";
import type { HotspotAnalysis, HotspotContext, HotspotFilters, HotspotIntakeItem, HotspotOptions, HotspotReports } from "./hotspot-types";

/** Explicit allowlist: never send timezone, raw GPS, owner IDs or response fields as filters. */
export function hotspotQuery(filters: HotspotFilters): string {
  const query = new URLSearchParams();
  if (filters.siteId !== null) query.set("siteId", String(filters.siteId));
  if (filters.area !== null) query.set("area", filters.area);
  if (filters.region !== null) query.set("region", filters.region);
  if (filters.threat !== null) query.set("threat", filters.threat);
  query.set("observedFrom", filters.observedFrom);
  query.set("observedTo", filters.observedTo);
  query.set("interval", filters.interval);
  return query.toString();
}

export function getHotspotOptions(signal?: AbortSignal): Promise<HotspotOptions> {
  return apiRequest({ path: "/api/v1/coordinator/hotspots/options", signal, cache: "no-store" });
}

export function getHotspotAnalysis(filters: HotspotFilters, signal?: AbortSignal): Promise<HotspotAnalysis> {
  return apiRequest({ path: `/api/v1/coordinator/hotspots?${hotspotQuery(filters)}`, signal, cache: "no-store" });
}

export function getHotspotReports(filters: HotspotFilters, page = 1, signal?: AbortSignal): Promise<HotspotReports> {
  const query = new URLSearchParams(hotspotQuery(filters));
  query.set("page", String(page));
  query.set("pageSize", "20");
  return apiRequest({ path: `/api/v1/coordinator/hotspots/reports?${query}`, signal, cache: "no-store" });
}

export function getHotspotIntake(reference: string, signal?: AbortSignal): Promise<HotspotIntakeItem> {
  return apiRequest({ path: `/api/v1/coordinator/hotspots/reports/${encodeURIComponent(reference)}/intake`, signal, cache: "no-store" });
}

export function getHotspotContext(reference: string, signal?: AbortSignal): Promise<HotspotContext> {
  return apiRequest({ path: `/api/v1/coordinator/reports/${encodeURIComponent(reference)}/hotspot-context`, signal, cache: "no-store" });
}

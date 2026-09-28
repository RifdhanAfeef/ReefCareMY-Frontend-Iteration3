import type { HotspotFilters, HotspotInterval, HotspotThreat } from "@/lib/api/hotspot-types";

const threatCodes: HotspotThreat[] = ["ghost_gear", "coral_bleaching", "marine_debris", "physical_damage", "unsure"];
const intervals: HotspotInterval[] = ["day", "week", "month"];
const allowedKeys = new Set(["siteId", "area", "region", "threat", "observedFrom", "observedTo", "interval"]);

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateHotspotFilters(filters: HotspotFilters): string | null {
  if (!validDate(filters.observedFrom) || !validDate(filters.observedTo)) return "Enter valid start and end dates.";
  const days = (Date.parse(`${filters.observedTo}T00:00:00Z`) - Date.parse(`${filters.observedFrom}T00:00:00Z`)) / 86_400_000 + 1;
  if (days < 1) return "The end date must be on or after the start date.";
  if (days > 366) return "Choose an observation period of 366 days or fewer.";
  if (Number(filters.observedFrom.slice(0, 4)) < 2 || Number(filters.observedTo.slice(0, 4)) > 9998) return "Choose dates between years 0002 and 9998.";
  if (filters.siteId !== null && (!Number.isSafeInteger(filters.siteId) || filters.siteId < 1)) return "Choose a valid dive site.";
  if (filters.threat !== null && !threatCodes.includes(filters.threat)) return "Choose one of the supported threat categories.";
  if (!intervals.includes(filters.interval)) return "Choose daily, weekly or monthly intervals.";
  if ([filters.area, filters.region].some((value) => value !== null && (!value.trim() || value.length > 200))) return "Choose a valid area and region.";
  return null;
}

export function parseHotspotFilters(query: string, defaults: HotspotFilters): { filters: HotspotFilters; error: string | null } {
  const params = new URLSearchParams(query);
  const filters: HotspotFilters = { ...defaults };
  for (const key of params.keys()) {
    if (!allowedKeys.has(key) || params.getAll(key).length !== 1) return { filters, error: "This link contains unsupported or repeated filters. Reset filters to continue." };
  }
  filters.siteId = params.has("siteId") ? Number(params.get("siteId")) : null;
  filters.area = params.get("area");
  filters.region = params.get("region");
  filters.threat = params.get("threat") as HotspotThreat | null;
  filters.interval = (params.get("interval") ?? defaults.interval) as HotspotInterval;
  if (params.has("observedFrom") !== params.has("observedTo")) return { filters, error: "This link needs both a start date and an end date. Reset filters or supply both." };
  filters.observedFrom = params.get("observedFrom") ?? defaults.observedFrom;
  filters.observedTo = params.get("observedTo") ?? defaults.observedTo;
  return { filters, error: validateHotspotFilters(filters) };
}

/** Date-only values are calendar labels, not instants in the browser timezone. */
export function calendarDate(value: string): string {
  if (!validDate(value)) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function malaysiaTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value));
}

export function periodLabel(filters: HotspotFilters): string {
  return `${calendarDate(filters.observedFrom)} – ${calendarDate(filters.observedTo)}`;
}

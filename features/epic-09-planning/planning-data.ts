import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";

export const areas = ["Perhentian", "Redang", "Tioman"] as const;
export type Area = (typeof areas)[number];
export type Band =
  | "more_favourable"
  | "mixed"
  | "less_favourable"
  | "unavailable"
  | "out_of_horizon";
export type Scenario = "normal" | "provider" | "ai" | "context" | "position";
export type Assessment = {
  band: Band;
  waves: number | null;
  wind: number | null;
  reason: string;
  retrievedAt: string;
  ruleVersion: string;
};
export type Plan = {
  planId: string;
  name: string;
  area: Area;
  plannedDate: string;
  siteIds: string[];
  updatedAt: string;
};
export const labels: Record<Band, string> = {
  more_favourable: "More favourable",
  mixed: "Mixed",
  less_favourable: "Less favourable",
  unavailable: "Unavailable",
  out_of_horizon: "Outside forecast range",
};
export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function dateLabel(date: string, long = false) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: long ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function dateRange(from: string, to: string): string[] {
  if (!validDate(from) || !validDate(to) || to < from) return [];
  const count = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (count > 14) return [];
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
export function sitesIn(area: Area) {
  return reefSites.filter(
    (site) => site.island === area && site.backendDiveSiteId > 0,
  );
}
export function bandFor(waves: number, wind: number): Band {
  if (waves > 1.5 || wind > 20) return "less_favourable";
  if (waves > 0.8 || wind > 12) return "mixed";
  return "more_favourable";
}
// Illustrative rules and signals only. This adapter never calls a live provider or AI service.
// Nearby sites share a sample provider cell; do not invent site precision.
export function assess(
  date: string,
  area: Area,
  today: string,
  scenario: Scenario = "normal",
  siteIndex = 0,
): Assessment {
  const base = {
    waves: null,
    wind: null,
    retrievedAt: `${today}T08:00:00+08:00`,
    ruleVersion: "prototype-v1",
  };
  if (date < today || date > addDays(today, 6))
    return {
      ...base,
      band: "out_of_horizon",
      reason:
        "No current forecast for this date. Seasonal reference remains available.",
    };
  if (scenario === "provider")
    return {
      ...base,
      band: "unavailable",
      reason:
        "The forecast provider is unavailable. No valid cached data is available.",
    };
  if (scenario === "position" && siteIndex === 0)
    return {
      ...base,
      band: "unavailable",
      reason: "Site position unavailable. This site cannot be assessed.",
    };
  const day = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  const key = (day + areas.indexOf(area) + Math.floor(siteIndex / 4)) % 5;
  const waves = [0.5, 0.7, 1.2, 1.8, 0.6][key];
  const wind = [8, 11, 16, 24, 9][key];
  const band = bandFor(waves, wind);
  return {
    ...base,
    waves,
    wind,
    band,
    reason:
      band === "more_favourable"
        ? "Wave height ≤ 0.8 m and wind ≤ 12 km/h in the illustrative rule."
        : band === "mixed"
          ? "Wave height > 0.8 m or wind > 12 km/h in the illustrative rule."
          : "Wave height > 1.5 m or wind > 20 km/h in the illustrative rule.",
  };
}
export function daySummary(
  date: string,
  area: Area,
  today: string,
  scenario: Scenario,
) {
  const results = sitesIn(area).map((_, index) =>
    assess(date, area, today, scenario, index),
  );
  const usable = results.filter((a) => a.waves !== null);
  const breakdown = { more_favourable: 0, mixed: 0, less_favourable: 0 };
  usable.forEach((a) => {
    if (a.band in breakdown) breakdown[a.band as keyof typeof breakdown]++;
  });
  // Conservative aggregate for the prototype, always accompanied by the site breakdown.
  const band: Band =
    usable.length === 0
      ? results[0].band
      : breakdown.less_favourable
        ? "less_favourable"
        : breakdown.mixed
          ? "mixed"
          : "more_favourable";
  return { band, count: usable.length, total: results.length, breakdown };
}
export function planKey(owner: string) {
  return `reefcare-i3-prototype-plans:${owner}`;
}
export function readPlans(owner: string): Plan[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(planKey(owner)) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value.filter(
      (p): p is Plan =>
        p &&
        typeof p.planId === "string" &&
        typeof p.name === "string" &&
        areas.includes(p.area) &&
        validDate(p.plannedDate) &&
        Array.isArray(p.siteIds) &&
        p.siteIds.length > 0 &&
        p.siteIds.every(
          (id: unknown) =>
            typeof id === "string" && sitesIn(p.area).some((s) => s.id === id),
        ),
    );
  } catch {
    return [];
  }
}
export function writePlans(owner: string, plans: Plan[]) {
  localStorage.setItem(planKey(owner), JSON.stringify(plans));
}
export function pastExample(today: string): Plan {
  return {
    planId: "example-past",
    name: "Last weekend in Perhentian",
    area: "Perhentian",
    plannedDate: addDays(today, -7),
    siteIds: [sitesIn("Perhentian")[0].id],
    updatedAt: new Date().toISOString(),
  };
}

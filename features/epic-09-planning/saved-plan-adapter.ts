import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";
import type {
  PlanWriteInput,
  SavedPlanResponse,
} from "@/lib/api/plansApi";
import { areas, type Area, type Plan } from "./planning-data";

export function areaCodeFor(area: Area) {
  return area.toLowerCase();
}

function areaForCode(areaCode: string): Area {
  const area = areas.find((item) => areaCode.toLowerCase() === item.toLowerCase());
  if (!area) throw new Error("The saved plan uses an unsupported reef area.");
  return area;
}

export function planWriteInput(
  name: string,
  area: Area,
  plannedDate: string,
  siteIds: string[],
): PlanWriteInput {
  const ids = siteIds.map((id) => {
    const site = reefSites.find(
      (item) => item.id === id && item.island === area && item.backendDiveSiteId > 0,
    );
    if (!site) throw new Error("A selected dive site is not available in this reef area.");
    return site.backendDiveSiteId;
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error("The same dive site cannot be added more than once.");
  }
  return { name: name.trim(), areaCode: areaCodeFor(area), plannedDate, diveSiteIds: ids };
}

export function planFromApi(value: SavedPlanResponse): Plan {
  const area = areaForCode(value.areaCode);
  const siteIds = value.diveSiteIds.map((backendId) => {
    const site = reefSites.find(
      (item) => item.backendDiveSiteId === backendId && item.island === area,
    );
    if (!site) throw new Error("A saved plan contains an unavailable dive site.");
    return site.id;
  });
  return {
    planId: String(value.planId),
    name: value.name,
    area,
    plannedDate: value.plannedDate,
    siteIds,
    updatedAt: value.updatedAt,
  };
}

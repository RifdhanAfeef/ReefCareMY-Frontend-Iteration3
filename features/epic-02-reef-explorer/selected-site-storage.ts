import type { ReefSiteReference } from "./types";

export const selectedReefSiteStorageKey = "reefcare-my-i2-selected-reef-site";
export const selectedReefSiteClearedEvent = "reefcare:selected-reef-site-cleared";

export type StoredReefSite = Pick<ReefSiteReference, "id" | "backendDiveSiteId" | "name" | "publicAreaLabel">;

export function storeSelectedReefSite(site: ReefSiteReference) {
  if (typeof window === "undefined") return;
  const stored: StoredReefSite = {
    id: site.id,
    backendDiveSiteId: site.backendDiveSiteId,
    name: site.name,
    publicAreaLabel: site.publicAreaLabel,
  };
  window.localStorage.setItem(selectedReefSiteStorageKey, JSON.stringify(stored));
}

export function readSelectedReefSite(): StoredReefSite | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(selectedReefSiteStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReefSite>;
    if (
      typeof parsed.id !== "string"
      || !Number.isInteger(parsed.backendDiveSiteId)
      || typeof parsed.name !== "string"
      || typeof parsed.publicAreaLabel !== "string"
    ) {
      window.localStorage.removeItem(selectedReefSiteStorageKey);
      return null;
    }
    return parsed as StoredReefSite;
  } catch {
    window.localStorage.removeItem(selectedReefSiteStorageKey);
    return null;
  }
}

export function clearSelectedReefSite() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(selectedReefSiteStorageKey);
  window.dispatchEvent(new Event(selectedReefSiteClearedEvent));
}


import { beforeEach, describe, expect, it, vi } from "vitest";
import { reefSites } from "../reef-sites";
import {
  clearSelectedReefSite,
  readSelectedReefSite,
  selectedReefSiteClearedEvent,
  selectedReefSiteStorageKey,
  storeSelectedReefSite,
} from "../selected-site-storage";

beforeEach(() => window.localStorage.clear());

describe("selected reef-site handoff", () => {
  it("stores only the public named-site context needed by reporting", () => {
    storeSelectedReefSite(reefSites[0]);

    expect(readSelectedReefSite()).toEqual({
      id: reefSites[0].id,
      backendDiveSiteId: reefSites[0].backendDiveSiteId,
      name: reefSites[0].name,
      publicAreaLabel: reefSites[0].publicAreaLabel,
    });
    expect(window.localStorage.getItem(selectedReefSiteStorageKey)).not.toContain("position");
  });

  it("clears a malformed value instead of using it", () => {
    window.localStorage.setItem(selectedReefSiteStorageKey, "{not valid json");
    expect(readSelectedReefSite()).toBeNull();
    expect(window.localStorage.getItem(selectedReefSiteStorageKey)).toBeNull();
  });

  it("can remove the handoff after it is no longer needed", () => {
    const cleared = vi.fn();
    window.addEventListener(selectedReefSiteClearedEvent, cleared, { once: true });
    storeSelectedReefSite(reefSites[0]);
    clearSelectedReefSite();
    expect(readSelectedReefSite()).toBeNull();
    expect(cleared).toHaveBeenCalledOnce();
  });
});


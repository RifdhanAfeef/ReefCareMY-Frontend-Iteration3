import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReefExplorerMap } from "../reef-explorer-map";

// Use real React Leaflet and Leaflet here: mocks miss parent-before-child
// teardown, when calling map.stop() after MapContainer.remove() can throw.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(500);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 1120px)" }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("can repeatedly show and hide the real mobile map, then leave the page", () => {
  function Page({ showMap }: { showMap: boolean }) {
    return <main>{showMap && <ReefExplorerMap sites={[]} selectedSiteId={null} selectedArea={null} mapOpen onSelectSite={() => {}} />}</main>;
  }
  const page = render(<Page showMap />);
  expect(document.querySelector(".leaflet-container")).toBeInTheDocument();
  expect(() => page.rerender(<Page showMap={false} />)).not.toThrow();
  expect(document.querySelector(".leaflet-container")).not.toBeInTheDocument();
  expect(() => page.rerender(<Page showMap />)).not.toThrow();
  expect(document.querySelector(".leaflet-container")).toBeInTheDocument();
  expect(() => page.unmount()).not.toThrow();
});

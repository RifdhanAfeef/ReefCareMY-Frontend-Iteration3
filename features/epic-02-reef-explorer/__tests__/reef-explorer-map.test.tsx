import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ReefExplorerMap } from "../reef-explorer-map";
import { reefSites } from "../reef-sites";
import { ReefMapBoundary } from "../reef-map-boundary";

const map = vi.hoisted(() => ({ stop: vi.fn(), invalidateSize: vi.fn(), getSize: vi.fn(), flyTo: vi.fn(), setView: vi.fn(), fitBounds: vi.fn() }));
vi.mock("react-leaflet", () => ({
  useMap: () => map,
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  Tooltip: () => null,
}));
beforeEach(() => { vi.clearAllMocks(); map.getSize.mockReturnValue({ x: 500, y: 400 }); });
afterEach(() => { vi.unstubAllGlobals(); });
const selected = () => render(<ReefExplorerMap sites={reefSites} selectedSiteId={reefSites[0].id} selectedArea={null} mapOpen onSelectSite={() => {}} />);

it("does not focus or animate a zero-sized hidden map", () => {
  map.getSize.mockReturnValue({ x: 0, y: 0 });
  selected();
  expect(map.flyTo).not.toHaveBeenCalled();
  expect(map.setView).not.toHaveBeenCalled();
  expect(map.fitBounds).not.toHaveBeenCalled();
});
it("selects mobile markers without a fly animation", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 1120px)" }));
  const view = selected();
  expect(map.setView).toHaveBeenCalledWith(reefSites[0].position, 12, { animate: false });
  expect(map.flyTo).not.toHaveBeenCalled();
  view.unmount();
  expect(map.stop).toHaveBeenCalledTimes(1);
});
it("retains desktop focus animation", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  selected();
  expect(map.flyTo).toHaveBeenCalledWith(reefSites[0].position, 12, { animate: true, duration: 0.6 });
});

it("isolates a map failure from site details and lets the user retry the map", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  function MapContent() {
    if (fail) throw new Error("Map failed");
    return <div>Map ready</div>;
  }
  try {
    render(<><h2>Site details</h2><ReefMapBoundary><MapContent /></ReefMapBoundary></>);
    expect(screen.getByRole("heading", { name: "Site details" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The map could not be loaded");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try loading the map again" }));
    expect(screen.getByText("Map ready")).toBeInTheDocument();
  } finally { log.mockRestore(); }
});

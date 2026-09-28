import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HotspotMap, usableMapSites } from "../hotspot-map";
import { analysis, mappedAnalysis } from "./fixtures";

const map = vi.hoisted(() => ({ invalidateSize: vi.fn(), fitBounds: vi.fn() }));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CircleMarker: ({ children, center }: { children: ReactNode; center: number[] }) => <div data-testid="approved-marker" data-center={center.join(",")}>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers: { tileerror: () => void } }) => <button onClick={eventHandlers.tileerror}>Simulate tile failure</button>,
  useMap: () => map,
}));
beforeEach(() => vi.clearAllMocks());
it("only maps approved finite anchors, retaining unmapped sites for summaries", () => {
  expect(usableMapSites(analysis.sites)).toHaveLength(0);
  const bad = { ...mappedAnalysis.sites[0], mapLocation: { ...mappedAnalysis.sites[0].mapLocation!, latitude: 91 } };
  expect(usableMapSites([...mappedAnalysis.sites, bad])).toHaveLength(2);
  render(<HotspotMap sites={[...mappedAnalysis.sites, ...analysis.sites, bad]} onSelect={vi.fn()} />);
  expect(screen.getAllByTestId("approved-marker")).toHaveLength(2);
  expect(map.fitBounds).toHaveBeenCalledWith([[2.82, 104.14], [2.86, 104.2]], expect.objectContaining({ maxZoom: 10 }));
});
it("selects named-site membership and keeps markers usable when base tiles fail", async () => {
  const select = vi.fn();
  render(<HotspotMap sites={mappedAnalysis.sites} onSelect={select} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Explore this site" })[0]);
  expect(select).toHaveBeenCalledWith(1);
  await userEvent.click(screen.getByRole("button", { name: "Simulate tile failure" }));
  expect(screen.getByRole("status")).toHaveTextContent(/Map background unavailable/);
  expect(screen.getAllByTestId("approved-marker")).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Retry map" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MalaysiaMap } from "../malaysia-map";

const map = vi.hoisted(() => ({
  invalidateSize: vi.fn(),
  fitBounds: vi.fn(),
  flyToBounds: vi.fn(),
  getBoundsZoom: vi.fn(() => 12),
  setView: vi.fn(),
  getZoom: vi.fn(() => 10),
  getContainer: vi.fn(),
  stop: vi.fn(),
}));
const tiles = vi.hoisted(() => ({
  isLoading: vi.fn(() => false),
  once: vi.fn(),
  off: vi.fn(),
}));

vi.mock("react-leaflet", () => ({
  useMap: () => map,
  useMapEvents: vi.fn(),
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ ref }: { ref: { current: typeof tiles } }) => {
    ref.current = tiles;
    return null;
  },
  Circle: () => null,
  CircleMarker: ({ children }: { children?: ReactNode }) => <div data-testid="map-marker">{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <span data-testid="site-tooltip">{children}</span>,
}));

const siteCentre = { latitude: 5.73206, longitude: 102.99727, x: 0, y: 0 };
const baseProps = {
  pin: null,
  siteCentre,
  siteName: "Terumbu Kili",
  diveSiteRadiusMetres: 5000,
  islandRadiusMetres: 15000,
  interactive: true,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  tiles.isLoading.mockReturnValue(false);
  map.getContainer.mockReturnValue(document.createElement("div"));
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("report location map", () => {
  it("zooms one level at a time from the 15 km area to the 5 km boundary", () => {
    render(<MalaysiaMap {...baseProps} />);

    expect(screen.getByTestId("site-tooltip")).toHaveTextContent("Terumbu Kili");
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.flyToBounds).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });

    expect(map.setView).toHaveBeenCalledWith(expect.anything(), 11, { animate: false });
    expect(map.flyToBounds).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(180); });
    expect(map.setView).toHaveBeenCalledWith(expect.anything(), 12, { animate: false });
    act(() => { vi.advanceTimersByTime(180); });
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    const outerBounds = map.fitBounds.mock.calls[0][0];
    const innerBounds = map.fitBounds.mock.calls[1][0];
    expect(outerBounds.getNorth() - outerBounds.getSouth()).toBeGreaterThan(innerBounds.getNorth() - innerBounds.getSouth());
  });

  it("does not restart or reposition the map after the observer chooses a pin", () => {
    const { rerender } = render(<MalaysiaMap {...baseProps} />);
    const container = map.getContainer.mock.results[0].value as HTMLElement;
    act(() => { container.dispatchEvent(new Event("pointerdown")); });
    rerender(<MalaysiaMap {...baseProps} pin={{ ...siteCentre, latitude: 5.733 }} />);
    act(() => { vi.advanceTimersByTime(500); });

    expect(map.flyToBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
    expect(map.stop).toHaveBeenCalled();
  });

  it("stops the zoom if the observer starts using the map during the animation", () => {
    const { rerender } = render(<MalaysiaMap {...baseProps} />);
    const container = map.getContainer.mock.results[0].value as HTMLElement;
    act(() => { vi.advanceTimersByTime(300); });
    expect(map.setView).toHaveBeenCalledTimes(1);

    act(() => { container.dispatchEvent(new Event("pointerdown")); });
    rerender(<MalaysiaMap {...baseProps} pin={{ ...siteCentre, latitude: 5.733 }} />);

    expect(map.stop).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(map.setView).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("waits for the next level's tiles before advancing", () => {
    tiles.isLoading.mockReturnValue(true);
    render(<MalaysiaMap {...baseProps} />);
    act(() => { vi.advanceTimersByTime(300); });

    expect(map.setView).toHaveBeenCalledTimes(1);
    expect(tiles.once).toHaveBeenCalledWith("load", expect.any(Function));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(map.setView).toHaveBeenCalledTimes(1);

    act(() => { tiles.once.mock.calls[0][1](); });
    act(() => { vi.advanceTimersByTime(180); });
    expect(map.setView).toHaveBeenCalledTimes(2);
  });

  it("keeps an existing pin in view without replaying the intro animation", () => {
    render(<MalaysiaMap {...baseProps} pin={{ ...siteCentre, latitude: 5.733 }} />);
    act(() => { vi.advanceTimersByTime(500); });

    expect(map.setView).toHaveBeenCalledWith([5.733, siteCentre.longitude], 11, { animate: false });
    expect(map.flyToBounds).not.toHaveBeenCalled();
  });

  it("shows the final boundary without animation when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(<MalaysiaMap {...baseProps} />);
    act(() => { vi.advanceTimersByTime(500); });

    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.flyToBounds).not.toHaveBeenCalled();
  });

  it("does not animate the non-interactive confirmation preview", () => {
    render(<MalaysiaMap {...baseProps} interactive={false} />);
    act(() => { vi.advanceTimersByTime(500); });

    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.flyToBounds).not.toHaveBeenCalled();
  });
});

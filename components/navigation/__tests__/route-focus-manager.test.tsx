import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteFocusManager } from "../route-focus-manager";

let pathname = "/report-a-reef";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("RouteFocusManager", () => {
  beforeEach(() => {
    pathname = "/report-a-reef";
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("moves keyboard focus to the page heading after route navigation", () => {
    const { rerender } = render(
      <main>
        <RouteFocusManager />
        <h1>Report details</h1>
      </main>,
    );

    const firstHeading = screen.getByRole("heading", { name: "Report details" });
    expect(firstHeading).toHaveFocus();
    expect(firstHeading).toHaveAttribute("tabindex", "-1");
    expect(firstHeading.style.outline).toBe("none");
    expect(firstHeading.style.boxShadow).toBe("none");

    pathname = "/report-a-reef/location";
    rerender(
      <main>
        <RouteFocusManager />
        <h1>Observation location</h1>
      </main>,
    );

    const nextHeading = screen.getByRole("heading", { name: "Observation location" });
    expect(nextHeading).toHaveFocus();
    expect(nextHeading).toHaveAttribute("tabindex", "-1");
    expect(nextHeading.style.outline).toBe("none");
    expect(nextHeading.style.boxShadow).toBe("none");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });
});

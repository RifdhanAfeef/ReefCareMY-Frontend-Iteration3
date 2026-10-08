import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableViewport } from "../table-viewport";

describe("table viewport", () => {
  it("provides controls at the top when columns overflow and keeps the table labelled", () => {
    render(<TableViewport label="Report intake table"><table><thead><tr><th>Report</th></tr></thead><tbody><tr><td>RC-1</td></tr></tbody></table></TableViewport>);
    const viewport = screen.getByRole("region", { name: "Report intake table" });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 900 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Next Report intake table columns" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous Report intake table columns" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next Report intake table columns" }));
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Previous Report intake table columns" })).toBeEnabled();
  });
});

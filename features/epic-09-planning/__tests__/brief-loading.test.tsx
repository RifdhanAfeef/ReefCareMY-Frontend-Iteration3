import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefLoading } from "../planning-panels";

describe("planning brief loading state", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function wait(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("reaches the last step within a typical ~4s brief", async () => {
    render(<BriefLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading the forecast facts");
    await wait(1000);
    expect(screen.getByRole("status")).toHaveTextContent("Adding recent reef context");
    await wait(1250);
    expect(screen.getByRole("status")).toHaveTextContent("Writing your brief");
  });

  it("only shows the slow note once the brief is taking longer than usual", async () => {
    render(<BriefLoading />);
    await wait(9750);
    expect(screen.queryByText(/longer than usual/)).not.toBeInTheDocument();
    await wait(250);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Taking longer than usual. This can take up to a minute.",
    );
  });
});

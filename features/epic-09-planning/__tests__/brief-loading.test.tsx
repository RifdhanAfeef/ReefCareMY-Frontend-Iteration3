import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefLoading } from "../planning-panels";

describe("planning brief loading state", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function wait(seconds: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(seconds * 1000);
    });
  }

  it("advances through the brief steps while the AI is writing", async () => {
    render(<BriefLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading the forecast facts");
    await wait(4);
    expect(screen.getByRole("status")).toHaveTextContent("Adding recent reef context");
    await wait(5);
    expect(screen.getByRole("status")).toHaveTextContent("Writing your brief");
  });

  it("reassures the user once the brief is taking a while", async () => {
    render(<BriefLoading />);
    expect(screen.queryByText(/up to 30 seconds/)).not.toBeInTheDocument();
    await wait(15);
    expect(screen.getByRole("status")).toHaveTextContent("Still working. This can take up to 30 seconds.");
  });
});

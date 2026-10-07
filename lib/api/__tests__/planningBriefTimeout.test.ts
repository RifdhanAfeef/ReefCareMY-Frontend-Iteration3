import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlanningBrief } from "../planningApi";

describe("planning brief request budget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function respondAfter(delayMs: number) {
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({ status: "unavailable" })), delayMs);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      }),
    ));
  }

  it("waits for forecast retrieval plus the backend's AI fallback", async () => {
    respondAfter(31_000);
    const result = createPlanningBrief(13, "2026-10-08").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await result).toEqual({ status: "unavailable" });
  });

  it("still stops a stalled brief after 60 seconds", async () => {
    respondAfter(90_000);
    const outcome = createPlanningBrief(13, "2026-10-08").catch((error: unknown) => error);
    let settled = false;
    void outcome.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toMatchObject({ name: "ApiError", status: 408 });
  });

  it("honours caller cancellation without waiting for the brief timeout", async () => {
    respondAfter(31_000);
    const controller = new AbortController();
    const result = expect(createPlanningBrief(13, "2026-10-08", controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
  });
});

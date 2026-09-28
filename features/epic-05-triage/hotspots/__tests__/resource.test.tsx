import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useHotspotResource } from "../use-hotspot-resource";

it("aborts the old request and prevents a late response from overwriting a new selection", async () => {
  let resolveOld!: (value: string) => void;
  let oldSignal!: AbortSignal;
  const oldLoad = vi.fn((signal: AbortSignal) => { oldSignal = signal; return new Promise<string>((resolve) => { resolveOld = resolve; }); });
  const newLoad = vi.fn(() => Promise.resolve("new selection"));
  const hook = renderHook(({ key, load }) => useHotspotResource(key, load), { initialProps: { key: "old", load: oldLoad } });
  hook.rerender({ key: "new", load: newLoad });
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() => expect(hook.result.current.data).toBe("new selection"));
  await act(async () => resolveOld("stale selection"));
  expect(hook.result.current.data).toBe("new selection");
});

it("hides old counts as soon as a refresh starts and exposes a failed refresh as an error", async () => {
  const load = vi.fn<(_: AbortSignal) => Promise<number>>().mockResolvedValueOnce(12).mockRejectedValueOnce(new Error("offline"));
  const hook = renderHook(({ key }) => useHotspotResource(key, load), { initialProps: { key: "first" } });
  await waitFor(() => expect(hook.result.current.data).toBe(12));
  hook.rerender({ key: "refresh" });
  expect(hook.result.current.loading).toBe(true);
  expect(hook.result.current.data).toBeNull();
  await waitFor(() => expect(hook.result.current.error).toBeInstanceOf(Error));
  expect(hook.result.current.data).toBeNull();
});

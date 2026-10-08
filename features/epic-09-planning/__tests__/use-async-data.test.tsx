import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAsyncData } from "../use-async-data";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("useAsyncData", () => {
  it("never renders the previous result once the dependencies change", async () => {
    const requests = { a: deferred<string>(), b: deferred<string>() };
    const rendered: unknown[] = [];
    const { result, rerender } = renderHook(({ key }: { key: "a" | "b" }) => {
      const value = useAsyncData(() => requests[key].promise, [key]);
      rendered.push({ key, state: value.state });
      return value;
    }, { initialProps: { key: "a" as "a" | "b" } });
    await act(async () => requests.a.resolve("data for a"));
    expect(result.current.state).toEqual({ status: "ready", data: "data for a" });

    rendered.length = 0;
    rerender({ key: "b" });
    expect(rendered).not.toContainEqual({ key: "b", state: { status: "ready", data: "data for a" } });
    expect(rendered[0]).toEqual({ key: "b", state: { status: "loading" } });

    await act(async () => requests.b.resolve("data for b"));
    expect(result.current.state).toEqual({ status: "ready", data: "data for b" });
  });

  it("ignores a superseded request that resolves late", async () => {
    const requests = { a: deferred<string>(), b: deferred<string>() };
    const { result, rerender } = renderHook(
      ({ key }: { key: "a" | "b" }) => useAsyncData(() => requests[key].promise, [key]),
      { initialProps: { key: "a" as "a" | "b" } },
    );
    rerender({ key: "b" });
    await act(async () => requests.b.resolve("data for b"));
    await act(async () => requests.a.resolve("data for a"));
    expect(result.current.state).toEqual({ status: "ready", data: "data for b" });
  });

  it("shows loading again while a retry is in flight", async () => {
    let request = deferred<string>();
    const { result } = renderHook(() => useAsyncData(() => request.promise, []));
    await act(async () => request.resolve("first"));
    expect(result.current.state).toEqual({ status: "ready", data: "first" });

    request = deferred<string>();
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: "loading" });
    await act(async () => request.resolve("second"));
    expect(result.current.state).toEqual({ status: "ready", data: "second" });
  });
});

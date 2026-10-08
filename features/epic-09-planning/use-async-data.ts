import { useCallback, useEffect, useState, type DependencyList } from "react";

export type AsyncData<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

type Settled<T> = { request: DependencyList; result: AsyncData<T> };

function sameRequest(a: DependencyList, b: DependencyList) {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

// Loads data whenever `deps` change and ignores results from superseded requests.
// `retry` re-runs the loader with the same dependencies.
// A result is only returned for the request that produced it, so the render right after `deps`
// change shows "loading" instead of the previous request's data.
export function useAsyncData<T>(load: () => Promise<T>, deps: DependencyList) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const request = [...deps, attempt];

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setSettled({ request, result: { status: "ready", data } });
      },
      (error: unknown) => {
        if (current) setSettled({ request, result: { status: "error", error } });
      },
    );
    return () => {
      current = false;
    };
    // The loader is intentionally keyed by the caller's deps, not its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, request);

  const state: AsyncData<T> =
    settled && sameRequest(settled.request, request) ? settled.result : { status: "loading" };
  return { state, retry };
}

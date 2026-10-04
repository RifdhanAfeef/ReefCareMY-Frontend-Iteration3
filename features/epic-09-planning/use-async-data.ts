import { useCallback, useEffect, useState, type DependencyList } from "react";

export type AsyncData<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

// Loads data whenever `deps` change and ignores results from superseded requests.
// `retry` re-runs the loader with the same dependencies.
export function useAsyncData<T>(load: () => Promise<T>, deps: DependencyList) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<AsyncData<T> | null>(null);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setSettled({ status: "ready", data });
      },
      (error: unknown) => {
        if (current) setSettled({ status: "error", error });
      },
    );
    return () => {
      current = false;
      setSettled(null);
    };
    // The loader is intentionally keyed by the caller's deps, not its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const state: AsyncData<T> = settled ?? { status: "loading" };
  return { state, retry };
}

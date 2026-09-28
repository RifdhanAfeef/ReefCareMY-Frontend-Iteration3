"use client";

import { useEffect, useState } from "react";

/** Key results by request and abort on navigation; stale responses never render. */
export function useHotspotResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown }>({ key: "", data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ key, data, error: null }); },
      (error: unknown) => { if (!controller.signal.aborted) setResult({ key, data: null, error }); },
    );
    return () => controller.abort();
  }, [key, load]);
  return result.key === key ? { ...result, loading: false } : { key, data: null, error: null, loading: true };
}

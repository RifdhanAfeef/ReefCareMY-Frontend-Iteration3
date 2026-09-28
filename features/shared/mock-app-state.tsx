"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LocationConfidenceCode } from "@/features/epic-01-access/types";
import type { ReportDraft } from "@/features/epic-02-reporting/types";
import { formatDateTime } from "@/lib/format/date";
import { useAuth } from "@/features/epic-01-access/auth-context";

export type LocationFlowStep =
  | "session"
  | "create"
  | "location"
  | "confirm"
  | "privacy"
  | "saved";

export type DiveSession = {
  id: string;
  backendId: number | null;
  namedDiveSiteId: number;
  site: string;
  label?: string;
  date?: string;
  start?: string;
  end?: string;
};

export type MapPin = {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
};

export type LocationDraft = {
  step: LocationFlowStep;
  sessions: DiveSession[];
  selectedSessionId: string;
  form: {
    site: string;
    label: string;
    date: string;
    start: string;
    end: string;
  };
  pin: MapPin | null;
  locationSource: "dive_site" | "map_pin" | "manual_coordinates";
  confidence: LocationConfidenceCode | "";
  surfaceEntryContext: string;
  surfaceExitContext: string;
};

export const initialLocationDraft: LocationDraft = {
  step: "session",
  sessions: [],
  selectedSessionId: "",
  form: { site: "", label: "", date: "", start: "", end: "" },
  pin: null,
  locationSource: "dive_site",
  confidence: "",
  surfaceEntryContext: "",
  surfaceExitContext: "",
};

export const initialReportDraft: ReportDraft = {
  threatCategoryCode: "",
  threatCategoryId: null,
  observationDate: "",
  observationTime: "",
  estimatedDepthMetres: "",
  description: "",
  photos: [],
  aiSuggestions: [],
  lastSavedAt: null,
};

function restoreReportDraft(stored?: Partial<ReportDraft>): ReportDraft {
  if (!stored) return initialReportDraft;
  return {
    ...initialReportDraft,
    ...stored,
    photos: Array.isArray(stored.photos) ? stored.photos : [],
    aiSuggestions: Array.isArray(stored.aiSuggestions)
      ? stored.aiSuggestions.map((suggestion) => ({
        ...suggestion,
        conflict: Boolean(suggestion.conflict),
        observerValue: suggestion.observerValue ?? null,
      }))
      : [],
  };
}

type AppStateContextValue = {
  locationDraft: LocationDraft;
  reportDraft: ReportDraft;
  isAccountDraftRestored: boolean;
  updateLocationDraft: (changes: Partial<LocationDraft>) => void;
  updateReportDraft: (changes: Partial<ReportDraft>) => void;
  saveReportDraft: () => void;
  resetReportDraft: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);
const storageKeyPrefix = "reefcare-my-iteration-1-state-v6";

export function accountDraftStorageKey(userId: number) {
  return `${storageKeyPrefix}:user:${userId}`;
}

export function MockAppStateProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const [locationDraft, setLocationDraft] = useState<LocationDraft>(initialLocationDraft);
  const [reportDraft, setReportDraft] = useState<ReportDraft>(initialReportDraft);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const activeStorageKey = status === "authenticated" && user
    ? accountDraftStorageKey(user.id)
    : null;

  useEffect(() => {
    if (status === "loading") return;
    let storedLocationDraft: LocationDraft | undefined;
    let storedReportDraft: ReportDraft | undefined;
    try {
      const stored = activeStorageKey ? window.localStorage.getItem(activeStorageKey) : null;
      if (stored) {
        const parsed = JSON.parse(stored) as {
          locationDraft?: LocationDraft;
          reportDraft?: ReportDraft;
        };
        if (parsed.locationDraft) storedLocationDraft = parsed.locationDraft;
        if (parsed.reportDraft) storedReportDraft = restoreReportDraft(parsed.reportDraft);
      }
    } catch {
      if (activeStorageKey) window.localStorage.removeItem(activeStorageKey);
    }
    const restoreTimer = window.setTimeout(() => {
      setLocationDraft(storedLocationDraft
        ? { ...initialLocationDraft, ...storedLocationDraft }
        : initialLocationDraft);
      setReportDraft(restoreReportDraft(storedReportDraft));
      setRestoredKey(activeStorageKey);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [activeStorageKey, status]);

  useEffect(() => {
    if (!activeStorageKey || restoredKey !== activeStorageKey) return;
    window.localStorage.setItem(activeStorageKey, JSON.stringify({ locationDraft, reportDraft }));
  }, [activeStorageKey, locationDraft, reportDraft, restoredKey]);

  const updateLocationDraft = useCallback((changes: Partial<LocationDraft>) => {
    setLocationDraft((current) => ({ ...current, ...changes }));
  }, []);

  const updateReportDraft = useCallback((changes: Partial<ReportDraft>) => {
    setReportDraft((current) => ({ ...current, ...changes }));
  }, []);

  const saveReportDraft = useCallback(() => {
    setReportDraft((current) => ({ ...current, lastSavedAt: formatDateTime() }));
  }, []);

  const resetReportDraft = useCallback(() => {
    setReportDraft(initialReportDraft);
    setLocationDraft(initialLocationDraft);
  }, []);

  const isAccountDraftRestored = status !== "loading" && restoredKey === activeStorageKey;

  const value = useMemo<AppStateContextValue>(
    () => ({
      locationDraft,
      reportDraft,
      isAccountDraftRestored,
      updateLocationDraft,
      updateReportDraft,
      saveReportDraft,
      resetReportDraft,
    }),
    [locationDraft, reportDraft, isAccountDraftRestored, updateLocationDraft, updateReportDraft, saveReportDraft, resetReportDraft],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useMockAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useMockAppState must be used within MockAppStateProvider");
  }
  return context;
}

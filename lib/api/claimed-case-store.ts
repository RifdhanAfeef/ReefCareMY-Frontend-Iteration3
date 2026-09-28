import type { ClaimedCase } from "./types";
import { readStoredAuth } from "./token-store";

const STORAGE_KEY = "reefcare.coordinator.claimed-cases.v1";

export type RememberedClaim = {
  reportReference: string;
  claimedAt: string;
};

type ClaimIndex = Record<string, RememberedClaim[]>;

function readIndex(): ClaimIndex {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as ClaimIndex : {};
  } catch {
    return {};
  }
}

function currentCoordinatorKey() {
  const auth = readStoredAuth();
  if (!auth || auth.user.role !== "case_coordinator") return null;
  return String(auth.user.id);
}

function writeIndex(index: ClaimIndex) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

export function rememberClaimedCase(claimedCase: ClaimedCase) {
  const coordinatorKey = currentCoordinatorKey();
  if (!coordinatorKey || readStoredAuth()?.user.id !== claimedCase.owner.id) return;

  const index = readIndex();
  const existing = index[coordinatorKey] ?? [];
  index[coordinatorKey] = [
    { reportReference: claimedCase.reportReference, claimedAt: claimedCase.claimedAt },
    ...existing.filter((item) => item.reportReference !== claimedCase.reportReference),
  ];
  writeIndex(index);
}

export function readRememberedClaims(): RememberedClaim[] {
  const coordinatorKey = currentCoordinatorKey();
  if (!coordinatorKey) return [];
  return readIndex()[coordinatorKey] ?? [];
}

export function forgetRememberedClaim(reportReference: string) {
  const coordinatorKey = currentCoordinatorKey();
  if (!coordinatorKey) return;

  const index = readIndex();
  index[coordinatorKey] = (index[coordinatorKey] ?? []).filter(
    (item) => item.reportReference !== reportReference,
  );
  writeIndex(index);
}

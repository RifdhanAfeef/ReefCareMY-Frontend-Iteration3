import { apiRequest } from "./client";
import type { DiveSession, DiveSessionCreate } from "./types";

export async function getDiveSessions(): Promise<DiveSession[]> {
  return apiRequest<DiveSession[]>({ path: "/api/v1/dive-sessions" });
}

export async function createDiveSession(payload: DiveSessionCreate): Promise<DiveSession> {
  return apiRequest<DiveSession>({
    path: "/api/v1/dive-sessions",
    method: "POST",
    body: payload,
  });
}

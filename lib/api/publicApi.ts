import { apiRequest } from "./client";
import type { PublicReportHandoffResponse, PublicSiteActivityResponse } from "./types";

export async function getPublicSiteActivity(
  diveSiteId: number,
  signal?: AbortSignal,
): Promise<PublicSiteActivityResponse> {
  return apiRequest<PublicSiteActivityResponse>({
    path: `/api/v1/public/dive-sites/${diveSiteId}/activity`,
    auth: false,
    signal,
  });
}

export async function getPublicReportHandoff(
  diveSiteId: number,
  signal?: AbortSignal,
): Promise<PublicReportHandoffResponse> {
  return apiRequest<PublicReportHandoffResponse>({
    path: `/api/v1/public/dive-sites/${diveSiteId}/report-handoff`,
    auth: false,
    signal,
  });
}

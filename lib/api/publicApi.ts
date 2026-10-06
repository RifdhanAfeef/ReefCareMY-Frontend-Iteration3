import { apiRequest } from "./client";
import type { PublicReportHandoffResponse, PublicSiteActivityResponse, PublicSiteContextResponse } from "./types";

export async function getPublicSiteContext(
  diveSiteId: number,
  signal?: AbortSignal,
): Promise<PublicSiteContextResponse> {
  return apiRequest<PublicSiteContextResponse>({
    path: `/api/v1/public/dive-sites/${diveSiteId}/context`,
    auth: false,
    signal,
  });
}

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

import { apiRequest } from "./client";
import type { PublicSiteActivityResponse } from "./types";

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

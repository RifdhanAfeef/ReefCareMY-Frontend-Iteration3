import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import {
  createPlanningBrief,
  getAreaDates,
  getAreaSeasonality,
  getAreaSites,
} from "../planningApi";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockResolvedValue({} as never);
});

describe("Epic 9 planning API", () => {
  it("reads public planning data without credentials", async () => {
    await getAreaSeasonality("perhentian");
    await getAreaDates("redang", "2026-10-03", "2026-10-07");
    await getAreaSites("tioman", "2026-10-03");
    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      path: "/api/v1/public/planning/areas/perhentian/seasonality",
      auth: false,
      signal: undefined,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, {
      path: "/api/v1/public/planning/areas/redang/dates?from=2026-10-03&to=2026-10-07",
      auth: false,
      signal: undefined,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, {
      path: "/api/v1/public/planning/areas/tioman/sites?date=2026-10-03",
      auth: false,
      signal: undefined,
    });
  });

  it("sends only the site and date when requesting a brief", async () => {
    await createPlanningBrief(13, "2026-10-03");
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/public/planning/brief",
      method: "POST",
      body: { siteId: 13, plannedDate: "2026-10-03" },
      timeoutMs: 60_000,
      auth: false,
      signal: undefined,
    });
  });
});

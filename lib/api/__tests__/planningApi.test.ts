import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import {
  createPlan,
  createPlanningBrief,
  deletePlan,
  getAreaDates,
  getAreaSeasonality,
  getAreaSites,
  listPlans,
  updatePlan,
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
      auth: false,
      signal: undefined,
    });
  });

  it("accepts plan lists returned as an array or as an items envelope", async () => {
    const plan = { planId: "p1", name: "Trip", areaCode: "redang", plannedDate: "2026-10-03", diveSiteIds: [21], updatedAt: "x" };
    mockedApiRequest.mockResolvedValueOnce([plan] as never);
    expect(await listPlans()).toEqual([plan]);
    mockedApiRequest.mockResolvedValueOnce({ items: [plan] } as never);
    expect(await listPlans()).toEqual([plan]);
  });

  it("uses authenticated requests for private plans", async () => {
    const payload = { name: "Trip", areaCode: "redang", plannedDate: "2026-10-03", diveSiteIds: [21] };
    await createPlan(payload);
    await updatePlan("a b", payload);
    await deletePlan("p1");
    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, { path: "/api/v1/plans", method: "POST", body: payload });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, { path: "/api/v1/plans/a%20b", method: "PATCH", body: payload });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, { path: "/api/v1/plans/p1", method: "DELETE" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import { getPlanningDates, getPlanningSites } from "../planningApi";

vi.mock("../client");
const request = vi.mocked(client.apiRequest);

describe("current planning assessment API", () => {
  beforeEach(() => request.mockReset());

  it("requests fresh public date and site assessments without authentication", async () => {
    request.mockResolvedValue(undefined);
    await getPlanningDates("redang", "2026-10-10", "2026-10-10");
    await getPlanningSites("redang", "2026-10-10");
    expect(request.mock.calls.map(([options]) => options)).toEqual([
      {
        path: "/api/v1/public/planning/areas/redang/dates?from=2026-10-10&to=2026-10-10",
        auth: false,
      },
      {
        path: "/api/v1/public/planning/areas/redang/sites?date=2026-10-10",
        auth: false,
      },
    ]);
  });
});

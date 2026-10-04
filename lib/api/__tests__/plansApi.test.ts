import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan,
  type PlanWriteInput,
} from "../plansApi";

vi.mock("../client");
const request = vi.mocked(client.apiRequest);
const body: PlanWriteInput = {
  name: "Redang dive plan",
  areaCode: "redang",
  plannedDate: "2026-10-10",
  diveSiteIds: [23, 21],
};

describe("saved plans API", () => {
  beforeEach(() => request.mockReset());

  it("uses the frozen Observer list and create contracts", async () => {
    request.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ planId: 12 });
    await listPlans();
    await createPlan(body);
    expect(request.mock.calls[0][0]).toEqual({ path: "/api/v1/plans" });
    expect(request.mock.calls[1][0]).toEqual({
      path: "/api/v1/plans",
      method: "POST",
      body,
    });
  });

  it("uses the frozen detail, update and delete routes", async () => {
    request.mockResolvedValue(undefined);
    await getPlan(12);
    await updatePlan(12, body);
    await deletePlan(12);
    expect(request.mock.calls.map(([options]) => options)).toEqual([
      { path: "/api/v1/plans/12" },
      { path: "/api/v1/plans/12", method: "PATCH", body },
      { path: "/api/v1/plans/12", method: "DELETE" },
    ]);
  });
});

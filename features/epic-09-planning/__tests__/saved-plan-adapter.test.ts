import { describe, expect, it } from "vitest";
import { planFromApi, planWriteInput } from "../saved-plan-adapter";

describe("saved plan adapter", () => {
  it("sends canonical area and numeric backend dive-site IDs only", () => {
    expect(
      planWriteInput("  Redang weekend  ", "Redang", "2026-10-10", [
        "redang-mini-mount",
        "redang-pulau-paku-besar",
      ]),
    ).toEqual({
      name: "Redang weekend",
      areaCode: "redang",
      plannedDate: "2026-10-10",
      diveSiteIds: [23, 21],
    });
  });

  it("maps the server response back to frontend site identities", () => {
    expect(
      planFromApi({
        planId: 12,
        name: "Redang weekend",
        areaCode: "redang",
        plannedDate: "2026-10-10",
        diveSiteIds: [23, 21],
        createdAt: "2026-10-04T09:00:00Z",
        updatedAt: "2026-10-04T09:00:00Z",
      }),
    ).toMatchObject({
      planId: "12",
      area: "Redang",
      siteIds: ["redang-mini-mount", "redang-pulau-paku-besar"],
    });
  });

  it("rejects a site that does not belong to the selected area", () => {
    expect(() =>
      planWriteInput("Wrong area", "Redang", "2026-10-10", [
        "perhentian-temple-of-the-sea",
      ]),
    ).toThrow("not available in this reef area");
  });
});

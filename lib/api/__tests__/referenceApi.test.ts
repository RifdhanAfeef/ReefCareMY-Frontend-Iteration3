import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import { getDiveSites, getThreatCategories } from "../referenceApi";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => mockedApiRequest.mockReset());

describe("reference API adapters", () => {
  it("normalises the snake_case threat example in backend section 8.12", async () => {
    mockedApiRequest.mockResolvedValue([
      {
        threat_category_id: 1,
        code: "ghost_gear",
        label: "Ghost fishing gear",
        short_explanation: "Lost fishing gear.",
        useful_evidence: "A clear photograph.",
        safety_reminder: "Observe safely.",
        icon_reference: null,
      },
    ]);

    await expect(getThreatCategories()).resolves.toEqual([
      {
        threatCategoryId: 1,
        code: "ghost_gear",
        label: "Ghost fishing gear",
        shortExplanation: "Lost fishing gear.",
        usefulEvidence: "A clear photograph.",
        safetyReminder: "Observe safely.",
        iconReference: null,
      },
    ]);
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/reference/threat-categories",
      auth: false,
    });
  });

  it("normalises the backend physical-damage code for report handoff", async () => {
    mockedApiRequest.mockResolvedValue([
      {
        threatCategoryId: 4,
        code: "physical_damage",
        label: "Physical reef damage",
        shortExplanation: "Recently damaged coral.",
        usefulEvidence: "A close and wider photograph.",
        safetyReminder: "Observe safely.",
        iconReference: null,
      },
    ]);

    await expect(getThreatCategories()).resolves.toEqual([
      expect.objectContaining({
        threatCategoryId: 4,
        code: "physical_reef_damage",
        label: "Physical reef damage",
      }),
    ]);
  });

  it("loads authenticated dive-site references", async () => {
    mockedApiRequest.mockResolvedValue([]);
    await getDiveSites();
    expect(mockedApiRequest).toHaveBeenCalledWith({ path: "/api/v1/reference/dive-sites" });
  });
});

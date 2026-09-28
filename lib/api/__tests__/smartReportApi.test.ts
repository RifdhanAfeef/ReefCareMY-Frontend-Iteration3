import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import { structureReportDescription } from "../smartReportApi";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("Smart Report Structuring API", () => {
  it("uses the documented Epic 4 AI endpoint and normalises the response", async () => {
    mockedApiRequest.mockResolvedValue({
      available: true,
      suggestions: { estimated_depth: 12, interaction: "tangled around coral" },
      missingFields: ["observation time"],
      warnings: [],
      requiresUserConfirmation: true,
    });

    const result = await structureReportDescription("A net was tangled around coral.");

    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/reports/smart-structure",
      method: "POST",
      body: { description: "A net was tangled around coral." },
      timeoutMs: 25_000,
    });
    expect(result.suggestions).toEqual([
      { field: "estimated_depth", label: "Estimated depth", suggestedValue: "12" },
      { field: "interaction", label: "Interaction", suggestedValue: "tangled around coral" },
    ]);
    expect(result.missingFields).toEqual(["observation time"]);
    expect(result.followUpQuestions).toEqual([]);
  });

  it("accepts the older array response without making AI mandatory", async () => {
    mockedApiRequest.mockResolvedValue({
      available: false,
      suggestions: [],
      missingInformation: [],
      message: "AI is unavailable.",
    });

    await expect(structureReportDescription("Manual description.")).resolves.toMatchObject({
      available: false,
      suggestions: [],
      missingFields: [],
      message: "AI is unavailable.",
    });
  });
});

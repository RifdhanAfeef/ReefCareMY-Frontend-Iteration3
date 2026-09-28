import { describe, expect, it } from "vitest";
import { formatCompletenessItem, observationCompletenessDisplay } from "../completeness-display";

describe("report completeness display", () => {
  it("uses user-facing labels and hides fields from the later location step", () => {
    const display = observationCompletenessDisplay({
      isSubmittable: false,
      blockingMissing: ["threatCategoryId", "observedAt", "description", "diveSessionId", "evidence", "location"],
      blockingIssues: [],
      recommendedMissing: ["estimatedDepthMetres"],
      summary: "6 required issues remain; 1 recommended field could improve the report.",
    });

    expect(display.required).toEqual([
      "Possible threat type",
      "Observation date and time",
      "What you observed",
      "Photographs",
    ]);
    expect(display.recommended).toEqual(["Estimated depth"]);
    expect(display.summary).toBe("4 required items remain; 1 optional detail could improve the report.");
  });

  it("converts unknown camel-case fields into readable words", () => {
    expect(formatCompletenessItem("waterVisibilityMetres")).toBe("Water visibility metres");
  });
});

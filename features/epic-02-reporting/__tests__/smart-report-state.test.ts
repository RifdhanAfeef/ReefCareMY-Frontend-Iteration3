import { describe, expect, it } from "vitest";
import { initialReportDraft } from "@/features/shared/mock-app-state";
import { applySuggestionValue, contextualFollowUps, mergeSmartReportSuggestions, suggestionStateLabel } from "../smart-report-state";

describe("Smart Report field state", () => {
  it("keeps Observer-entered information and marks a different AI value for checking", () => {
    const suggestions = mergeSmartReportSuggestions({
      ...initialReportDraft,
      estimatedDepthMetres: "13",
    }, [{ field: "estimated_depth_metres", label: "Estimated depth", suggestedValue: "10-15 m" }]);

    expect(suggestions[0]).toMatchObject({
      field: "estimated_depth_metres",
      observerValue: "13 m",
      suggestedValue: "10-15 m",
      status: "unresolved",
      conflict: true,
    });
    expect(suggestionStateLabel(suggestions[0])).toBe("Needs checking");
  });

  it("does not create a suggestion for Not specified values", () => {
    expect(mergeSmartReportSuggestions(initialReportDraft, [
      { field: "possible_threat", label: "Possible threat", suggestedValue: "Not specified" },
    ])).toEqual([]);
  });

  it("selects only relevant predefined follow-up questions", () => {
    const report = {
      ...initialReportDraft,
      aiSuggestions: mergeSmartReportSuggestions(initialReportDraft, [
        { field: "possible_threat", label: "Possible threat", suggestedValue: "Ghost fishing gear" },
      ]),
    };
    const questions = contextualFollowUps(report, []);
    expect(questions).toHaveLength(2);
    expect(questions[0].question).toMatch(/how large/i);
    expect(questions[1].question).toMatch(/marine animals/i);
  });

  it("uses the backend threat-category id when an AI threat is accepted", () => {
    const suggestion = mergeSmartReportSuggestions(initialReportDraft, [
      { field: "possible_threat", label: "Possible threat", suggestedValue: "Ghost fishing gear" },
    ])[0];
    expect(applySuggestionValue(initialReportDraft, suggestion, [{
      threatCategoryId: 401,
      code: "ghost_gear",
      label: "Ghost fishing gear",
      shortExplanation: "",
      usefulEvidence: "",
      safetyReminder: "",
      iconReference: null,
    }])).toEqual({ threatCategoryCode: "ghost_gear", threatCategoryId: 401 });
  });
});

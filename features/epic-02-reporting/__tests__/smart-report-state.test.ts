import type { ReportDraft, SmartReportField } from "../types";
import { describe, expect, it } from "vitest";
import { initialReportDraft } from "@/features/shared/mock-app-state";
import { applySuggestionValue, automaticDepthChanges, automaticThreatChanges, contextualFollowUps, mergeSmartReportSuggestions, suggestionStateLabel } from "../smart-report-state";

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


describe("refreshing additional details from a revised description", () => {
  function analyse(report: ReportDraft, value: string) {
    const suggestions = mergeSmartReportSuggestions(report, [{ field: "estimated_depth", label: "Estimated depth", suggestedValue: value }]);
    return { ...report, ...automaticDepthChanges(report, suggestions), aiSuggestions: suggestions };
  }

  it("keeps automatic depth unreviewed, even on a repeated result, then updates it", () => {
    let report = analyse(initialReportDraft, "2 metres");
    expect(report).toMatchObject({ estimatedDepthMetres: "2", estimatedDepthSource: "ai" });
    report = analyse(report, "2 metres");
    expect(report.aiSuggestions[0]).toMatchObject({ status: "unresolved", conflict: false });
    report = analyse(report, "5 metres");
    expect(report).toMatchObject({ estimatedDepthMetres: "5", estimatedDepthSource: "ai" });
    expect(report.aiSuggestions[0]).toMatchObject({ suggestedValue: "5 metres", status: "unresolved", conflict: false });
  });

  it.each(["corrected", "confirmed"] as const)("preserves a %s depth instead of replacing it", (status) => {
    const initial = analyse(initialReportDraft, "2 m");
    const report = analyse({ ...initial, estimatedDepthSource: "observer", aiSuggestions: initial.aiSuggestions.map((item) => ({ ...item, status })) }, "5 m");
    expect(report.estimatedDepthMetres).toBe("2");
    expect(report.aiSuggestions[0]).toMatchObject({ observerValue: "2 m", suggestedValue: "5 m", conflict: true });
  });

  it("refreshes unreviewed depth in an older draft while preserving unknown or confirmed values", () => {
    const automatic = analyse(initialReportDraft, "2 m");
    const oldDraft = { ...automatic };
    delete oldDraft.estimatedDepthSource;
    expect(analyse(oldDraft, "5 m").estimatedDepthMetres).toBe("5");
    expect(analyse({ ...initialReportDraft, estimatedDepthMetres: "2" }, "5 m").estimatedDepthMetres).toBe("2");
    expect(analyse({ ...oldDraft, aiSuggestions: oldDraft.aiSuggestions.map((item) => ({ ...item, status: "confirmed" })) }, "5 m").estimatedDepthMetres).toBe("2");
  });

  it("preserves a deliberately cleared depth and offers the new value", () => {
    const report = analyse({ ...initialReportDraft, estimatedDepthSource: "observer" }, "5 m");
    expect(report.estimatedDepthMetres).toBe("");
    expect(report.aiSuggestions[0]).toMatchObject({ observerValue: "", conflict: true });
  });

  it("removes unsupported automatic depth but retains human depth when analysis omits it", () => {
    const automatic = analyse(initialReportDraft, "2 m");
    expect(automaticDepthChanges(automatic, [])).toMatchObject({ estimatedDepthMetres: "" });
    expect(automaticDepthChanges({ ...automatic, estimatedDepthSource: "observer" }, [])).toEqual({});
  });

  it("supports zero depth and leaves a range for manual review", () => {
    expect(analyse(initialReportDraft, "0 metres").estimatedDepthMetres).toBe("0");
    const report = analyse(analyse(initialReportDraft, "2 m"), "10-15 m");
    expect(report.estimatedDepthMetres).toBe("2");
    expect(report.aiSuggestions[0].conflict).toBe(true);
    expect(applySuggestionValue(report, report.aiSuggestions[0])).toEqual({});
  });

  const detailFields: SmartReportField[] = ["approximate_size", "coral_interaction", "animal_interaction", "site_reference"];
  it.each(detailFields)("refreshes untouched %s but preserves a manual entry through repeated analyses", (field) => {
    const incoming = (value: string) => [{ field, label: field, suggestedValue: value }];
    const first = mergeSmartReportSuggestions(initialReportDraft, incoming("Old detail"));
    const report = { ...initialReportDraft, aiSuggestions: first };
    expect(mergeSmartReportSuggestions(report, incoming("New detail"))[0]).toMatchObject({ suggestedValue: "New detail", status: "unresolved", conflict: false });
    const manual = { ...report, aiSuggestions: first.map((item) => ({ ...item, suggestedValue: "My entry", status: "corrected" as const })) };
    const conflict = mergeSmartReportSuggestions(manual, incoming("New detail"));
    expect(conflict[0]).toMatchObject({ observerValue: "My entry", suggestedValue: "New detail", conflict: true });
    expect(mergeSmartReportSuggestions({ ...manual, aiSuggestions: conflict }, incoming("Another detail"))[0]).toMatchObject({ observerValue: "My entry", suggestedValue: "Another detail", conflict: true });
    expect(mergeSmartReportSuggestions({ ...manual, aiSuggestions: conflict }, [])[0]).toMatchObject({ suggestedValue: "My entry", status: "corrected", conflict: false });
  });

  it.each(detailFields)("keeps confirmed and removed %s when the revised description omits it", (field) => {
    const first = mergeSmartReportSuggestions(initialReportDraft, [{ field, label: field, suggestedValue: "Old detail" }]);
    expect(mergeSmartReportSuggestions({ ...initialReportDraft, aiSuggestions: first }, [])).toEqual([]);
    for (const status of ["confirmed", "removed"] as const) {
      const entry = { ...first[0], status };
      expect(mergeSmartReportSuggestions({ ...initialReportDraft, aiSuggestions: [entry] }, [])).toEqual([entry]);
    }
  });
});


describe("refreshing only automatic text threat choices", () => {
  function analyse(report: ReportDraft, value: string) {
    const suggestions = mergeSmartReportSuggestions(report, [{ field: "possible_threat", label: "Possible threat", suggestedValue: value }]);
    return { ...report, ...automaticThreatChanges(report, suggestions), aiSuggestions: suggestions };
  }

  it("refreshes an untouched text category instead of creating an artificial conflict", () => {
    let report = analyse(initialReportDraft, "Ghost fishing gear");
    expect(report).toMatchObject({ threatCategoryCode: "ghost_gear", threatCategorySource: "ai" });
    report = analyse(report, "Ghost fishing gear");
    expect(report.aiSuggestions[0].status).toBe("unresolved");
    report = analyse(report, "Coral bleaching");
    expect(report).toMatchObject({ threatCategoryCode: "coral_bleaching", threatCategorySource: "ai" });
    expect(report.aiSuggestions[0]).toMatchObject({ conflict: false, status: "unresolved" });
  });

  it("preserves explicit category choices, including a cleared dropdown", () => {
    const report = analyse(initialReportDraft, "Ghost fishing gear");
    expect(analyse({ ...report, threatCategorySource: "observer" }, "Coral bleaching").threatCategoryCode).toBe("ghost_gear");
    const cleared = analyse({ ...initialReportDraft, threatCategorySource: "observer" }, "Coral bleaching");
    expect(cleared.threatCategoryCode).toBe("");
    expect(cleared.aiSuggestions[0].conflict).toBe(true);
  });

  it.each(["accepted", "kept", "changed"] as const)("never overwrites a photo decision that was %s, including older drafts", (resolution) => {
    const report = analyse(initialReportDraft, "Ghost fishing gear");
    report.visualRecognition = { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "ghost_gear",
      suggestedThreatLabel: "Ghost fishing gear", confidence: 0.9, warning: null, resolution };
    expect(analyse(report, "Coral bleaching").threatCategoryCode).toBe("ghost_gear");
  });

  it("clears an unsupported automatic text category but keeps an explicit choice", () => {
    const report = analyse(initialReportDraft, "Ghost fishing gear");
    expect(automaticThreatChanges(report, [])).toMatchObject({ threatCategoryCode: "", threatCategoryId: null });
    expect(automaticThreatChanges({ ...report, threatCategorySource: "observer" }, [])).toEqual({});
  });
});


it.each(["estimated_depth_metres", "possible_threat"] as const)("keeps the confirmed %s record when analysis omits it", (field) => {
  const previous = mergeSmartReportSuggestions(initialReportDraft, [{ field, label: field,
    suggestedValue: field === "possible_threat" ? "Ghost fishing gear" : "2 m" }])[0];
  const confirmed = { ...previous, status: "confirmed" as const };
  const report: ReportDraft = { ...initialReportDraft, aiSuggestions: [confirmed],
    estimatedDepthMetres: "2", estimatedDepthSource: "observer", threatCategoryCode: "ghost_gear", threatCategorySource: "observer" };
  expect(mergeSmartReportSuggestions(report, [])).toEqual([confirmed]);
});

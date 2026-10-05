import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAutomaticPhotoDraftChanges, ObservationForm } from "../observation-form";
import { structureReportDescription } from "@/lib/api/smartReportApi";
import { getThreatCategories } from "@/lib/api/referenceApi";
import { clearDraftPhotos, loadDraftPhotos } from "@/features/epic-02-reporting/draft-storage";
import { recognizeVisualThreat } from "@/lib/api/visualRecognitionApi";
import type { ReportDraft } from "../types";

const { resetReportDraft, updateReportDraft, runtime } = vi.hoisted(() => ({
  resetReportDraft: vi.fn(),
  updateReportDraft: vi.fn(),
  runtime: {
    draftRestored: undefined as boolean | undefined,
    reportDraft: {
      threatCategoryCode: "",
      threatCategoryId: null,
      observationDate: "",
      observationTime: "",
      estimatedDepthMetres: "",
      description: "A large fishing net is tangled around coral at about 12 metres.",
      photos: [],
      aiSuggestions: [],
      visualRecognition: null,
      lastSavedAt: null,
    } as ReportDraft,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/features/shared/mock-app-state", () => ({
  useMockAppState: () => ({
    reportDraft: runtime.reportDraft,
    isAccountDraftRestored: runtime.draftRestored,
    locationDraft: {
      sessions: [],
      selectedSessionId: "",
      locationSource: "dive_site",
      confidence: "",
      pin: null,
    },
    updateReportDraft,
    saveReportDraft: vi.fn(),
    resetReportDraft,
  }),
}));

vi.mock("@/features/epic-02-reporting/draft-storage", () => ({
  createPhotoId: vi.fn(),
  clearDraftPhotos: vi.fn().mockResolvedValue(undefined),
  loadDraftPhotos: vi.fn().mockResolvedValue([]),
  saveDraftPhotos: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/referenceApi", () => ({
  getThreatCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/api/reportsApi", () => ({
  checkReportCompleteness: vi.fn(),
}));

vi.mock("@/lib/api/smartReportApi", () => ({
  structureReportDescription: vi.fn(),
}));

vi.mock("@/lib/api/visualRecognitionApi", () => ({
  recognizeVisualThreat: vi.fn(),
}));

describe("automatic Smart Report Structuring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runtime.draftRestored = undefined;
    runtime.reportDraft = {
      threatCategoryCode: "",
      threatCategoryId: null,
      observationDate: "",
      observationTime: "",
      estimatedDepthMetres: "",
      description: "A large fishing net is tangled around coral at about 12 metres.",
      photos: [],
      aiSuggestions: [],
      visualRecognition: null,
      lastSavedAt: null,
    };
    vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:restored-photo");
    URL.revokeObjectURL = vi.fn();
    vi.mocked(loadDraftPhotos).mockResolvedValue([]);
    vi.mocked(structureReportDescription).mockResolvedValue({
      available: true,
      suggestions: [{ field: "estimated_depth", label: "Estimated depth", suggestedValue: "12m" }],
      missingFields: ["approximate size"],
      followUpQuestions: [],
      warnings: [],
      requiresUserConfirmation: true,
    });
    vi.mocked(recognizeVisualThreat).mockResolvedValue({
      status: "recognized",
      suggestedThreat: { code: "ghost_gear", label: "Ghost fishing gear" },
      confidence: 0.87,
      warning: null,
    });
  });

  afterEach(() => vi.useRealTimers());

  it("analyses the description after typing pauses without requiring a button", async () => {
    render(<ObservationForm />);

    expect(screen.getByRole("list", { name: "Report progress" })).toBeInTheDocument();
    expect(screen.getByText("Observation").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Check my description" })).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(structureReportDescription).toHaveBeenCalledWith(
      "A large fishing net is tangled around coral at about 12 metres.",
    );
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      estimatedDepthMetres: "12",
      aiSuggestions: [expect.objectContaining({ field: "estimated_depth_metres", status: "unresolved", conflict: false })],
    }));
    expect(screen.getByText(/Consider adding: approximate size/i)).toBeInTheDocument();
  });

  it("loads photo file date and time immediately while preserving values already entered", () => {
    const file = new File(["reef"], "reef.jpg", {
      type: "image/jpeg",
      lastModified: Date.parse("2026-08-28T07:26:21Z"),
    });

    const automatic = buildAutomaticPhotoDraftChanges(
      [{ id: "photo-1", file }],
      [],
      "",
      "",
    );
    expect(automatic.changes).toEqual(expect.objectContaining({
      observationDate: "28/08/2026",
      observationTime: "15:26",
      photos: [expect.objectContaining({ capturedAtConfirmed: true })],
    }));

    const preserved = buildAutomaticPhotoDraftChanges(
      [{ id: "photo-1", file }],
      [],
      "27/08/2026",
      "14:10",
    );
    expect(preserved.changes).not.toHaveProperty("observationDate");
    expect(preserved.changes).not.toHaveProperty("observationTime");
  });

  it("analyses a newly attached photo without overwriting the observer threat", async () => {
    const file = new File(["reef"], "reef.jpg", { type: "image/jpeg" });
    const { createPhotoId } = await import("@/features/epic-02-reporting/draft-storage");
    vi.mocked(createPhotoId).mockReturnValue("photo-1");
    render(<ObservationForm />);

    fireEvent.change(screen.getByLabelText("Choose photos"), { target: { files: [file] } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recognizeVisualThreat).toHaveBeenCalledWith(file);
    expect(updateReportDraft).toHaveBeenCalledWith({
      visualRecognition: expect.objectContaining({
        photoId: "photo-1",
        suggestedThreatCode: "ghost_gear",
        resolution: "unresolved",
      }),
    });
    const recognitionChange = vi.mocked(updateReportDraft).mock.calls.find(([changes]) => "visualRecognition" in changes)?.[0];
    expect(recognitionChange).not.toHaveProperty("threatCategoryCode");
  });

  it("lets the observer review image analysis on the photo-upload page", async () => {
    runtime.reportDraft = {
      ...runtime.reportDraft,
      threatCategoryCode: "ghost_gear",
      threatCategoryId: 41,
      visualRecognition: {
        photoId: "photo-1",
        photoName: "reef.jpg",
        status: "recognized",
        suggestedThreatCode: "coral_bleaching",
        suggestedThreatLabel: "Coral bleaching",
        confidence: 0.9,
        warning: null,
        resolution: "unresolved",
      },
    };
    vi.mocked(getThreatCategories).mockResolvedValue([
      {
        threatCategoryId: 42,
        code: "coral_bleaching",
        label: "Coral bleaching",
        shortExplanation: "Pale coral.",
        usefulEvidence: "A photograph.",
        safetyReminder: "Observe safely.",
        iconReference: null,
      },
    ]);
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole("heading", { name: "IMAGE ANALYSIS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Two checks, using two different inputs" })).toBeInTheDocument();
    expect(screen.getByText("From your uploaded photo")).toBeInTheDocument();
    expect(screen.getByText("From your written description")).toBeInTheDocument();
    expect(screen.queryByText("Possible visual threat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use image suggestion" }));

    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      threatCategoryCode: "coral_bleaching",
      threatCategoryId: 42,
      visualRecognition: expect.objectContaining({ resolution: "accepted" }),
    }));
  });

  it("selects the physical-damage category carried from the threat explorer", async () => {
    vi.mocked(getThreatCategories).mockResolvedValue([{
      threatCategoryId: 44,
      code: "physical_reef_damage",
      label: "Physical reef damage",
      shortExplanation: "Recently damaged coral.",
      usefulEvidence: "A close and wider photograph.",
      safetyReminder: "Observe safely.",
      iconReference: null,
    }]);

    render(<ObservationForm initialThreat="physical_reef_damage" />);
    await act(async () => { await Promise.resolve(); });

    expect(updateReportDraft).toHaveBeenCalledWith({
      threatCategoryCode: "physical_reef_damage",
      threatCategoryId: 44,
    });
  });

  it("keeps a dive-plan date advisory and converts it to the editable report format", async () => {
    render(<ObservationForm plannedDate="2026-10-03" />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Your plan is not evidence of a dive. Confirm your Dive Session and site in the location step.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use suggested date" }));
    expect(updateReportDraft).toHaveBeenCalledWith({ observationDate: "03/10/2026" });
  });

  it("waits for the account draft and preserves its observation time when restoring photos", async () => {
    const file = new File(["reef"], "reef.jpg", {
      type: "image/jpeg",
      lastModified: Date.parse("2026-09-16T15:14:00Z"),
    });
    vi.mocked(loadDraftPhotos).mockResolvedValue([{ id: "photo-1", file }]);
    runtime.draftRestored = false;
    const view = render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    expect(loadDraftPhotos).not.toHaveBeenCalled();

    runtime.reportDraft = {
      ...runtime.reportDraft,
      observationDate: "16/09/2026",
      observationTime: "10:30",
    };
    runtime.draftRestored = true;
    view.rerender(<ObservationForm />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadDraftPhotos).toHaveBeenCalledTimes(1);
    const photoRestoreChanges = vi.mocked(updateReportDraft).mock.calls
      .map(([changes]) => changes)
      .find((changes) => "photos" in changes);
    expect(photoRestoreChanges).toEqual(expect.objectContaining({
      photos: [expect.objectContaining({ id: "photo-1" })],
    }));
    expect(photoRestoreChanges).not.toHaveProperty("observationDate");
    expect(photoRestoreChanges).not.toHaveProperty("observationTime");
  });

  it("confirms before clearing the current report and locally stored photos", async () => {
    render(<ObservationForm />);

    fireEvent.click(screen.getByRole("button", { name: "Reset report" }));
    const dialog = screen.getByRole("dialog", { name: "Start a fresh report?" });
    expect(dialog).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Reset report" }));
      await Promise.resolve();
    });

    expect(clearDraftPhotos).toHaveBeenCalledTimes(1);
    expect(resetReportDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Start a fresh report?" })).not.toBeInTheDocument();
  });
});

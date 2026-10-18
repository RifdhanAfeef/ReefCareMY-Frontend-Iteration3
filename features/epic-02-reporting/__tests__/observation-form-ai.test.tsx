import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAutomaticPhotoDraftChanges, ObservationForm } from "../observation-form";
import { structureReportDescription } from "@/lib/api/smartReportApi";
import { getThreatCategories } from "@/lib/api/referenceApi";
import { clearDraftPhotos, loadDraftPhotos } from "@/features/epic-02-reporting/draft-storage";
import { recognizeVisualThreat } from "@/lib/api/visualRecognitionApi";
import { readExifCaptureTime } from "../photo-exif";
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
      step: "session",
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

// EXIF parsing has its own tests; form tests control the returned capture time.
vi.mock("@/features/epic-02-reporting/photo-exif", () => ({
  readExifCaptureTime: vi.fn().mockResolvedValue(null),
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
    updateReportDraft.mockReset();
    vi.mocked(readExifCaptureTime).mockReset().mockResolvedValue(null);
    URL.createObjectURL = vi.fn(() => "blob:restored-photo");
    URL.revokeObjectURL = vi.fn();
    vi.mocked(loadDraftPhotos).mockResolvedValue([]);
    vi.mocked(clearDraftPhotos).mockReset().mockResolvedValue(undefined);
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

  it("shows one category choice in the review sidebar and one depth field in additional details", () => {
    render(<ObservationForm />);
    const sidebar = screen.getByRole("complementary", { name: "Your review" });
    expect(within(sidebar).getByRole("combobox", { name: "Threat category *" })).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveLength(1);
    expect(screen.queryByText("What did you see? *")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("analyses the description after typing pauses without requiring a button", async () => {
    render(<ObservationForm />);

    expect(screen.getByRole("list", { name: "Report progress" })).toBeInTheDocument();
    expect(screen.getByText("Observation").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Check my description" })).not.toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1299);
    });
    expect(structureReportDescription).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(structureReportDescription).toHaveBeenCalledWith(
      "A large fishing net is tangled around coral at about 12 metres.",
    );
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      estimatedDepthMetres: "12",
      aiSuggestions: [expect.objectContaining({ field: "estimated_depth_metres", status: "unresolved", conflict: false })],
    }));
    expect(screen.getByText(/Consider adding: approximate size/i)).toBeInTheDocument();
  });

  it("fills the threat and depth from the description when neither was chosen", async () => {
    vi.mocked(getThreatCategories).mockResolvedValue([{
      threatCategoryId: 41,
      code: "ghost_gear",
      label: "Ghost fishing gear",
      shortExplanation: "Fishing gear left underwater.",
      usefulEvidence: "A photo of the gear.",
      safetyReminder: "Keep a safe distance.",
      iconReference: null,
    }]);
    vi.mocked(structureReportDescription).mockResolvedValue({
      available: true,
      suggestions: [
        { field: "possible_threat", label: "Possible threat type", suggestedValue: "Ghost fishing gear" },
        { field: "estimated_depth", label: "Estimated depth", suggestedValue: "12m" },
      ],
      missingFields: [],
      followUpQuestions: [],
      warnings: [],
      requiresUserConfirmation: true,
    });

    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      threatCategoryCode: "ghost_gear",
      threatCategoryId: 41,
      estimatedDepthMetres: "12",
      aiSuggestions: expect.arrayContaining([
        expect.objectContaining({ field: "possible_threat" }),
        expect.objectContaining({ field: "estimated_depth_metres" }),
      ]),
    }));
  });

  it("shows all six structured fields and keeps threat and depth edits in the report", async () => {
    vi.mocked(getThreatCategories).mockResolvedValue([{
      threatCategoryId: 41,
      code: "ghost_gear",
      label: "Ghost fishing gear",
      shortExplanation: "Fishing gear left underwater.",
      usefulEvidence: "A photo of the gear.",
      safetyReminder: "Keep a safe distance.",
      iconReference: null,
    }]);
    runtime.reportDraft = {
      ...runtime.reportDraft,
      threatCategoryCode: "ghost_gear",
      threatCategoryId: 41,
      estimatedDepthMetres: "10",
      aiSuggestions: [{
        source: "smart_report",
        field: "estimated_depth_metres",
        label: "Estimated depth",
        suggestedValue: "10 m",
        confidence: null,
        status: "unresolved",
        conflict: false,
        observerValue: null,
      }],
    };

    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });

    const descriptionCheck = screen.getByRole("heading", { name: "Additional details" }).closest("section")!;
    expect(within(descriptionCheck).getAllByRole("textbox")).toHaveLength(4);
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("ghost_gear");
    expect(within(descriptionCheck).getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(10);
    expect(within(descriptionCheck).getByRole("textbox", { name: "Approximate size" })).toBeInTheDocument();
    expect(within(descriptionCheck).getByRole("textbox", { name: "Coral interaction" })).toBeInTheDocument();
    expect(within(descriptionCheck).getByRole("textbox", { name: "Marine-animal interaction" })).toBeInTheDocument();
    expect(within(descriptionCheck).getByRole("textbox", { name: "Site reference" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Threat category *" }), { target: { value: "" } });
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({ threatCategoryCode: "", threatCategoryId: null }));
    fireEvent.change(within(descriptionCheck).getByRole("spinbutton", { name: "Estimated depth (m)" }), { target: { value: "12" } });
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({ estimatedDepthMetres: "12" }));
  });

  it("loads the EXIF capture date and time immediately while preserving values already entered", () => {
    const file = new File(["reef"], "reef.jpg", {
      type: "image/jpeg",
      lastModified: Date.parse("2026-10-09T11:32:00Z"),
    });

    const automatic = buildAutomaticPhotoDraftChanges(
      [{ id: "photo-1", file }],
      [],
      "",
      "",
      { "photo-1": "2026-08-28T07:26:21.000Z" },
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
      { "photo-1": "2026-08-28T07:26:21.000Z" },
    );
    expect(preserved.changes).not.toHaveProperty("observationDate");
    expect(preserved.changes).not.toHaveProperty("observationTime");
  });

  it("does not use the file's modified date when the photo has no EXIF capture time (QA-R4-02)", () => {
    const file = new File(["reef"], "reef.jpg", {
      type: "image/jpeg",
      lastModified: Date.parse("2026-10-09T11:32:00Z"),
    });

    const automatic = buildAutomaticPhotoDraftChanges([{ id: "photo-1", file }], [], "", "", { "photo-1": null });

    expect(automatic.automaticValues).toBeNull();
    expect(automatic.changes).not.toHaveProperty("observationDate");
    expect(automatic.changes).not.toHaveProperty("observationTime");
    expect(automatic.changes.photos).toEqual([expect.objectContaining({ capturedAt: null, capturedAtConfirmed: false })]);
  });

  it("fills blank date and time from an attached photo and explains the source", async () => {
    const { createPhotoId } = await import("../draft-storage");
    vi.mocked(createPhotoId).mockReturnValue("photo-1");
    vi.mocked(readExifCaptureTime).mockResolvedValue("2026-09-15T02:15:00.000Z");
    render(<ObservationForm />);
    fireEvent.change(screen.getByLabelText("Add photos"), { target: { files: [new File(["reef"], "reef.png", { type: "image/png" })] } });
    await act(async () => { for (let tick = 0; tick < 8; tick += 1) await Promise.resolve(); });
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({ observationDate: "15/09/2026", observationTime: "10:15" }));
    expect(screen.getByText(/Photo date and time added/)).toBeInTheDocument();
  });

  it("preserves dates entered while photo metadata is still loading", async () => {
    const { createPhotoId } = await import("../draft-storage");
    vi.mocked(createPhotoId).mockReturnValue("photo-1");
    let finish!: (time: string | null) => void;
    vi.mocked(readExifCaptureTime).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText("Add photos"), { target: { files: [new File(["reef"], "reef.jpg", { type: "image/jpeg" })] } });
    runtime.reportDraft = { ...runtime.reportDraft, observationDate: "14/09/2026", observationTime: "11:30" };
    view.rerender(<ObservationForm />);
    await act(async () => { finish("2026-09-15T02:15:00.000Z"); for (let tick = 0; tick < 8; tick += 1) await Promise.resolve(); });
    const changes = vi.mocked(updateReportDraft).mock.calls.map(([item]) => item).find((item) => "photos" in item);
    expect(changes).not.toHaveProperty("observationDate");
    expect(changes).not.toHaveProperty("observationTime");
    expect(screen.getByText(/Your existing date and time have been kept/)).toBeInTheDocument();
  });

  it("analyses a newly attached photo without overwriting the observer threat", async () => {
    const file = new File(["reef"], "reef.jpg", { type: "image/jpeg" });
    const { createPhotoId } = await import("@/features/epic-02-reporting/draft-storage");
    vi.mocked(createPhotoId).mockReturnValue("photo-1");
    render(<ObservationForm />);

    fireEvent.change(screen.getByLabelText("Add photos"), { target: { files: [file] } });
    // Reading the photo's EXIF data adds an asynchronous step before the analysis call.
    await act(async () => {
      for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
    });

    expect(screen.getByText(/No photo capture time found/)).toBeInTheDocument();
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

  it("shows a single spinner status while the description is being read", async () => {
    vi.mocked(structureReportDescription).mockReturnValue(new Promise(() => {}));
    render(<ObservationForm />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });

    const reading = screen.getAllByText("Reading your description…");
    expect(reading).toHaveLength(1);
    const line = reading[0].closest("[role=status]");
    expect(line).not.toBeNull();
    expect(line?.querySelector("[aria-hidden=true]")).not.toBeNull();
    expect(screen.queryByText(/Analysing your description/)).not.toBeInTheDocument();
    const threatPanel = screen.getByRole("region", { name: "AI suggested threat" });
    expect(within(threatPanel).queryByText(/Reading your description/)).not.toBeInTheDocument();
  });

  it("shows a single spinner status in the threat panel while a photo is checked", async () => {
    vi.mocked(recognizeVisualThreat).mockReturnValue(new Promise(() => {}));
    const file = new File(["reef"], "reef.jpg", { type: "image/jpeg" });
    const { createPhotoId } = await import("@/features/epic-02-reporting/draft-storage");
    vi.mocked(createPhotoId).mockReturnValue("photo-1");
    render(<ObservationForm />);

    fireEvent.change(screen.getByLabelText("Add photos"), { target: { files: [file] } });
    await act(async () => {
      for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
    });

    const threatPanel = screen.getByRole("region", { name: "AI suggested threat" });
    expect(threatPanel).not.toHaveAttribute("aria-busy");
    const checking = screen.getAllByText("Checking reef.jpg for reef threats…");
    expect(checking).toHaveLength(1);
    expect(threatPanel).toContainElement(checking[0]);
    expect(checking[0].closest("[role=status]")?.querySelector("[aria-hidden=true]")).not.toBeNull();
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

    expect(screen.getByRole("heading", { name: "AI suggested threat" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Your review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Additional details" })).toBeInTheDocument();
    expect(screen.queryByText("Possible visual threat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use this category" }));

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

    runtime.reportDraft = { ...runtime.reportDraft, description: "" };
    render(<ObservationForm initialThreat="physical_reef_damage" />);
    await act(async () => { await Promise.resolve(); });

    expect(updateReportDraft).toHaveBeenCalledWith({
      threatCategoryCode: "physical_reef_damage",
      threatCategoryId: 44,
      threatCategorySource: "observer",
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
      for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
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

  it("asks before continuing an unsent draft when a report is started from a dive plan (QA-R4-03)", async () => {
    runtime.reportDraft = { ...runtime.reportDraft, photos: [{ id: "old-photo", name: "old.jpg", type: "image/jpeg", size: 10 }] };
    render(<ObservationForm fromExplorer plannedDate="2026-10-10" />);
    await act(async () => { await Promise.resolve(); });

    const dialog = screen.getByRole("dialog", { name: "You have a report in progress" });
    expect(dialog).toHaveTextContent("Your unsubmitted report and 1 photo are saved on this device.");
    expect(within(dialog).getByRole("button", { name: "Continue report" })).toHaveFocus();
    // Old photos are not brought back into the form until the observer chooses.
    expect(loadDraftPhotos).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue report" }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole("dialog", { name: "You have a report in progress" })).not.toBeInTheDocument();
    expect(loadDraftPhotos).toHaveBeenCalledTimes(1);
    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(clearDraftPhotos).not.toHaveBeenCalled();
  });

  it("discards the unsent draft and its photos when the observer starts a new report", async () => {
    render(<ObservationForm fromExplorer />);
    await act(async () => { await Promise.resolve(); });

    const dialog = screen.getByRole("dialog", { name: "You have a report in progress" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Discard and start new" }));
      await Promise.resolve();
    });

    expect(clearDraftPhotos).toHaveBeenCalledTimes(1);
    expect(resetReportDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "You have a report in progress" })).not.toBeInTheDocument();
  });

  it("keeps the draft and says so when it cannot be cleared", async () => {
    vi.mocked(clearDraftPhotos).mockRejectedValueOnce(new Error("blocked"));
    render(<ObservationForm fromExplorer />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard and start new" }));
      await Promise.resolve();
    });

    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Your saved report could not be cleared from this device.");
  });

  it("does not apply a threat from the threat explorer to an unsent draft before the observer chooses", async () => {
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

    expect(screen.getByRole("dialog", { name: "You have a report in progress" })).toBeInTheDocument();
    expect(updateReportDraft).not.toHaveBeenCalledWith(expect.objectContaining({ threatCategoryCode: "physical_reef_damage" }));
  });

  it("continues the draft without asking when the form is reopened from the report itself", async () => {
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole("dialog", { name: "You have a report in progress" })).not.toBeInTheDocument();
    expect(loadDraftPhotos).toHaveBeenCalledTimes(1);
  });

  it("does not ask when there is no unsent draft", async () => {
    runtime.reportDraft = { ...runtime.reportDraft, description: "" };
    render(<ObservationForm fromExplorer plannedDate="2026-10-10" />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByRole("dialog", { name: "You have a report in progress" })).not.toBeInTheDocument();
    expect(loadDraftPhotos).toHaveBeenCalledTimes(1);
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

  it("keeps manual category selection available in the sidebar", async () => {
    vi.mocked(getThreatCategories).mockResolvedValue([
      { threatCategoryId: 41, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
      { threatCategoryId: 45, code: "unsure", label: "Not sure", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    ]);
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });

    const picker = screen.getByRole("combobox", { name: "Threat category *" });
    fireEvent.change(picker, { target: { value: "ghost_gear" } });

    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      threatCategoryCode: "ghost_gear",
      threatCategoryId: 41,
    }));
  });

  it("summarises what is missing and moves focus to the summary", async () => {
    runtime.reportDraft = { ...runtime.reportDraft, description: "" };
    render(<ObservationForm />);

    fireEvent.click(screen.getByRole("button", { name: "Continue to location" }));

    const summary = screen.getByRole("alert", { name: /things need fixing before you continue/ });
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole("link", { name: "Select the closest threat category." })).toBeInTheDocument();
    expect(within(summary).getByRole("link", { name: "Describe what you observed." })).toBeInTheDocument();
  });

  it("keeps optional AI suggestions folded away until there is something to check", () => {
    runtime.reportDraft = { ...runtime.reportDraft, description: "" };
    render(<ObservationForm />);

    expect(screen.getByText("Add a photo for an automatic suggestion.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Photo check" })).not.toBeInTheDocument();
  });
  it("shows conflicting photo and description suggestions separately without changing the category", async () => {
    runtime.reportDraft = { ...runtime.reportDraft, threatCategoryCode: "coral_bleaching", threatCategoryId: 42,
      aiSuggestions: [{ source: "smart_report", field: "possible_threat", label: "Possible threat type", suggestedValue: "Ghost fishing gear", confidence: null, status: "unresolved", conflict: false, observerValue: null }],
      visualRecognition: { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "coral_bleaching", suggestedThreatLabel: "Coral bleaching", confidence: null, warning: null, resolution: "unresolved" } };
    vi.mocked(getThreatCategories).mockResolvedValue([
      { threatCategoryId: 41, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
      { threatCategoryId: 42, code: "coral_bleaching", label: "Coral bleaching", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    ]);
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/The photo and description suggest different threats/)).toBeInTheDocument();
    expect(screen.getByText("Photo analysis")).toBeInTheDocument();
    expect(screen.getByText("Description analysis")).toBeInTheDocument();
    expect(screen.getByText("Confidence unavailable")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("coral_bleaching");
    expect(screen.getByRole("button", { name: "Use photo threat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use description" }));
    expect(updateReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      threatCategoryCode: "ghost_gear", threatCategoryId: 41,
      aiSuggestions: [expect.objectContaining({ status: "confirmed", conflict: false })],
      visualRecognition: expect.objectContaining({ resolution: "kept" }),
    }));
  });
  it.each(["Use photo threat", "Use description"])("reopens a photo decision after a conflicting description and resolves it with %s", async (choice) => {
    runtime.reportDraft = { ...runtime.reportDraft, description: "",
      visualRecognition: { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "coral_bleaching", suggestedThreatLabel: "Coral bleaching", confidence: 0.9, warning: null, resolution: "unresolved" } };
    vi.mocked(getThreatCategories).mockResolvedValue([
      { threatCategoryId: 41, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
      { threatCategoryId: 42, code: "coral_bleaching", label: "Coral bleaching", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    ]);
    vi.mocked(structureReportDescription).mockResolvedValue({ available: true,
      suggestions: [{ field: "possible_threat", label: "Possible threat", suggestedValue: "Ghost fishing gear" }],
      missingFields: [], followUpQuestions: [], warnings: [], requiresUserConfirmation: true });
    const view = render(<ObservationForm />);
    await act(async () => { for (let tick = 0; tick < 8; tick += 1) await Promise.resolve(); });
    const applyChange = () => {
      runtime.reportDraft = { ...runtime.reportDraft, ...updateReportDraft.mock.lastCall![0] };
      view.rerender(<ObservationForm />);
    };
    fireEvent.click(screen.getByRole("button", { name: "Use this category" }));
    applyChange();
    expect(screen.getByRole("img", { name: "Photo suggestion decision confirmed" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /^Description \*/ }), { target: { value: "A fishing net was tangled around the coral." } });
    applyChange();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(updateReportDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      visualRecognition: expect.objectContaining({ resolution: "unresolved" }),
      aiSuggestions: [expect.objectContaining({ status: "unresolved", conflict: true })],
    }));
    applyChange();
    expect(screen.getByRole("button", { name: "Use photo threat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use description" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Photo suggestion decision confirmed" })).not.toBeInTheDocument();
    // A new AI suggestion must not change the category until a human chooses.
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("coral_bleaching");
    fireEvent.click(screen.getByRole("button", { name: choice }));
    applyChange();
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue(choice === "Use photo threat" ? "coral_bleaching" : "ghost_gear");
    expect(runtime.reportDraft.aiSuggestions[0]).toEqual(expect.objectContaining({
      status: choice === "Use photo threat" ? "corrected" : "confirmed", conflict: false,
    }));
    expect(screen.getByRole("img", { name: "Photo suggestion decision confirmed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use photo threat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use description" })).not.toBeInTheDocument();
  });

  it.each(["accepted", "kept", "changed"] as const)("restores both conflict buttons for an older draft with photo resolution %s", async (resolution) => {
    runtime.reportDraft = { ...runtime.reportDraft, threatCategoryCode: "coral_bleaching", threatCategoryId: 42,
      aiSuggestions: [{ source: "smart_report", field: "possible_threat", label: "Possible threat", suggestedValue: "Ghost fishing gear", confidence: null, status: "unresolved", conflict: true, observerValue: "Coral bleaching" }],
      visualRecognition: { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "coral_bleaching", suggestedThreatLabel: "Coral bleaching", confidence: 0.9, warning: null, resolution } };
    vi.mocked(getThreatCategories).mockResolvedValue([
      { threatCategoryId: 41, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
      { threatCategoryId: 42, code: "coral_bleaching", label: "Coral bleaching", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    ]);
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Use photo threat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use description" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Photo suggestion decision confirmed" })).not.toBeInTheDocument();
  });

  it("keeps a photo decision confirmed when the later description agrees", async () => {
    runtime.reportDraft = { ...runtime.reportDraft, threatCategoryCode: "coral_bleaching", threatCategoryId: 42,
      visualRecognition: { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "coral_bleaching", suggestedThreatLabel: "Coral bleaching", confidence: 0.9, warning: null, resolution: "accepted" } };
    vi.mocked(structureReportDescription).mockResolvedValue({ available: true,
      suggestions: [{ field: "possible_threat", label: "Possible threat", suggestedValue: "Coral bleaching" }],
      missingFields: [], followUpQuestions: [], warnings: [], requiresUserConfirmation: true });
    render(<ObservationForm />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    const changes = updateReportDraft.mock.lastCall![0];
    expect(changes).not.toHaveProperty("visualRecognition");
    expect(changes.aiSuggestions).toEqual([expect.objectContaining({ status: "confirmed", conflict: false })]);
  });

  it("allows manual choices when photo analysis is unavailable without a misleading accept button", () => {
    runtime.reportDraft.visualRecognition = { photoId: "one", photoName: "reef.jpg", status: "unavailable", suggestedThreatCode: null, suggestedThreatLabel: null, confidence: null, warning: "Image analysis is temporarily unavailable.", resolution: "not_required" };
    render(<ObservationForm />);
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use this category" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Image analysis is temporarily unavailable.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Check this photo")).not.toBeInTheDocument();
  });

  it("does not show acceptance or confirmation for a response with no supported threat", async () => {
    runtime.reportDraft.visualRecognition = { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: null, suggestedThreatLabel: null, confidence: null, warning: null, resolution: "not_required" };
    render(<ObservationForm />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("button", { name: "Use this category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Photo suggestion decision confirmed" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toBeInTheDocument();
  });

  function useStatefulDraft() {
    updateReportDraft.mockImplementation((changes: Partial<ReportDraft>) => {
      runtime.reportDraft = { ...runtime.reportDraft, ...changes };
    });
    const view = render(<ObservationForm />);
    return {
      async analyse(suggestions: Array<{ field: string; label: string; suggestedValue: string }>, description: string) {
        vi.mocked(structureReportDescription).mockResolvedValue({ available: true, suggestions,
          missingFields: [], followUpQuestions: [], warnings: [], requiresUserConfirmation: true });
        fireEvent.change(screen.getByRole("textbox", { name: /^Description/ }), { target: { value: description } });
        view.rerender(<ObservationForm />);
        await act(async () => { await Promise.resolve(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
        view.rerender(<ObservationForm />);
      },
      refresh() { view.rerender(<ObservationForm />); },
    };
  }

  it("automatically refreshes depth after the description changes, without marking it confirmed", async () => {
    const draft = useStatefulDraft();
    await draft.analyse([{ field: "estimated_depth", label: "Estimated depth", suggestedValue: "2 metres" }], "A net at 2 metres deep.");
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(2);
    await draft.analyse([{ field: "estimated_depth", label: "Estimated depth", suggestedValue: "5 metres" }], "A net at 5 metres deep.");
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(5);
    expect(runtime.reportDraft).toMatchObject({ estimatedDepthSource: "ai", aiSuggestions: [expect.objectContaining({ status: "unresolved", conflict: false })] });
    expect(screen.queryByText("Needs checking")).not.toBeInTheDocument();
  });

  it("preserves edited depth and lets the observer explicitly use the new suggestion", async () => {
    const draft = useStatefulDraft();
    const suggestion = (depth: number) => [{ field: "estimated_depth", label: "Estimated depth", suggestedValue: `${depth} m` }];
    await draft.analyse(suggestion(2), "A net at 2 metres deep.");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Estimated depth (m)" }), { target: { value: "3" } });
    draft.refresh();
    await draft.analyse(suggestion(5), "A net at 5 metres deep.");
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(3);
    fireEvent.click(screen.getByRole("button", { name: "Use 5 m" }));
    draft.refresh();
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(5);
    expect(runtime.reportDraft.estimatedDepthSource).toBe("observer");
    await draft.analyse(suggestion(7), "A net at 7 metres deep.");
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(5);
    expect(screen.getByRole("button", { name: "Use 7 m" })).toBeInTheDocument();
  });

  it("keeps depth deliberately cleared by the observer blank", async () => {
    const draft = useStatefulDraft();
    await draft.analyse([{ field: "estimated_depth", label: "Estimated depth", suggestedValue: "2 m" }], "A net at 2 metres deep.");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Estimated depth (m)" }), { target: { value: "" } });
    draft.refresh();
    await draft.analyse([{ field: "estimated_depth", label: "Estimated depth", suggestedValue: "5 m" }], "A net at 5 metres deep.");
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Use 5 m" })).toBeInTheDocument();
  });

  const otherDetails = [
    ["approximate_size", "Approximate size", "Small patch", "Several metres"],
    ["coral_interaction", "Coral interaction", "No coral contact", "Touching coral"],
    ["animal_interaction", "Marine-animal interaction", "No animals trapped", "A trapped fish"],
    ["site_reference", "Site reference", "North of the reef", "South of the reef"],
  ];
  it.each(otherDetails)("automatically refreshes untouched %s", async (field, label, oldValue, newValue) => {
    const draft = useStatefulDraft();
    await draft.analyse([{ field, label, suggestedValue: oldValue }], `I saw ${oldValue}.`);
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(oldValue);
    await draft.analyse([{ field, label, suggestedValue: newValue }], `I saw ${newValue}.`);
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(newValue);
    expect(runtime.reportDraft.aiSuggestions[0]).toMatchObject({ status: "unresolved", conflict: false });
  });

  it.each(otherDetails)("preserves an edited %s and offers the new suggestion", async (field, label, oldValue, newValue) => {
    const draft = useStatefulDraft();
    await draft.analyse([{ field, label, suggestedValue: oldValue }], `I saw ${oldValue}.`);
    fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value: "My own entry" } });
    draft.refresh();
    await draft.analyse([{ field, label, suggestedValue: newValue }], `I saw ${newValue}.`);
    expect(screen.getByRole("textbox", { name: label })).toHaveValue("My own entry");
    expect(runtime.reportDraft.aiSuggestions[0]).toMatchObject({ observerValue: "My own entry", suggestedValue: newValue, conflict: true });
    fireEvent.click(screen.getByRole("button", { name: `Use suggestion for ${label.toLowerCase()}` }));
    draft.refresh();
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(newValue);
    expect(runtime.reportDraft.aiSuggestions[0]).toMatchObject({ status: "confirmed", conflict: false });
    await draft.analyse([{ field, label, suggestedValue: "Another suggestion" }], "I saw something else instead.");
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(newValue);
  });

  it("keeps a confirmed detail when the revised description no longer includes it", async () => {
    const draft = useStatefulDraft();
    await draft.analyse([{ field: "site_reference", label: "Site reference", suggestedValue: "North reef" }], "Net on the north reef.");
    runtime.reportDraft.aiSuggestions[0].status = "confirmed";
    draft.refresh();
    await draft.analyse([], "A fishing net tangled on coral.");
    expect(screen.getByRole("textbox", { name: "Site reference" })).toHaveValue("North reef");
    expect(runtime.reportDraft.aiSuggestions[0].status).toBe("confirmed");
  });

  it("preserves manual details entered while description analysis is still loading", async () => {
    const draft = useStatefulDraft();
    let finish!: (value: Awaited<ReturnType<typeof structureReportDescription>>) => void;
    vi.mocked(structureReportDescription).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Estimated depth (m)" }), { target: { value: "3" } });
    draft.refresh();
    fireEvent.change(screen.getByRole("textbox", { name: "Site reference" }), { target: { value: "My reef" } });
    draft.refresh();
    await act(async () => { finish({ available: true, suggestions: [
      { field: "estimated_depth", label: "Estimated depth", suggestedValue: "5 m" },
      { field: "site_reference", label: "Site reference", suggestedValue: "Another reef" },
    ], missingFields: [], followUpQuestions: [], warnings: [], requiresUserConfirmation: true }); });
    draft.refresh();
    expect(screen.getByRole("spinbutton", { name: "Estimated depth (m)" })).toHaveValue(3);
    expect(screen.getByRole("textbox", { name: "Site reference" })).toHaveValue("My reef");
    expect(screen.getByRole("button", { name: "Use 5 m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use suggestion for site reference" })).toBeInTheDocument();
  });

  it("refreshes an untouched text threat category but preserves a later dropdown choice", async () => {
    vi.mocked(getThreatCategories).mockResolvedValue([
      { threatCategoryId: 41, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
      { threatCategoryId: 42, code: "coral_bleaching", label: "Coral bleaching", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    ]);
    const draft = useStatefulDraft();
    await draft.analyse([{ field: "possible_threat", label: "Possible threat", suggestedValue: "Ghost fishing gear" }], "Fishing gear tangled in coral.");
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("ghost_gear");
    await draft.analyse([{ field: "possible_threat", label: "Possible threat", suggestedValue: "Coral bleaching" }], "The coral looks bleached.");
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("coral_bleaching");
    expect(runtime.reportDraft).toMatchObject({ threatCategorySource: "ai", aiSuggestions: [expect.objectContaining({ status: "unresolved", conflict: false })] });
    fireEvent.change(screen.getByRole("combobox", { name: "Threat category *" }), { target: { value: "ghost_gear" } });
    draft.refresh();
    await draft.analyse([{ field: "possible_threat", label: "Possible threat", suggestedValue: "Coral bleaching" }], "I saw pale coral colonies.");
    expect(screen.getByRole("combobox", { name: "Threat category *" })).toHaveValue("ghost_gear");
    expect(runtime.reportDraft.threatCategorySource).toBe("observer");
  });

});

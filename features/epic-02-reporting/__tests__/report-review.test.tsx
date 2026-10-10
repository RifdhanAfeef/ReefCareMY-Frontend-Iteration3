import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { reviewReport, submitReport } from "@/lib/api/reportsApi";
import { getThreatCategories } from "@/lib/api/referenceApi";
import { clearDraftPhotos, loadDraftPhotos } from "../draft-storage";
import { ReportReview } from "../report-review";

const push = vi.hoisted(() => vi.fn());
const scenario = vi.hoisted(() => ({
  aiSuggestions: [] as Array<Record<string, unknown>>,
  visualRecognition: null as Record<string, unknown> | null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/reportsApi", () => ({ reviewReport: vi.fn(), submitReport: vi.fn() }));
vi.mock("@/lib/api/referenceApi", () => ({ getThreatCategories: vi.fn() }));
vi.mock("../draft-storage", () => ({ loadDraftPhotos: vi.fn(), clearDraftPhotos: vi.fn() }));
vi.mock("@/features/epic-04-location/location-flow", () => ({ ReviewLocationSummary: () => null }));
vi.mock("@/features/shared/mock-app-state", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/shared/mock-app-state")>();
  return { ...original, useMockAppState: () => {
    const [reportDraft, setReport] = useState<typeof original.initialReportDraft>({ ...original.initialReportDraft,
      threatCategoryCode: "ghost_gear", threatCategoryId: 1,
      observationDate: "01/01/2020", observationTime: "10:00", description: "Net on coral.",
      aiSuggestions: scenario.aiSuggestions as typeof original.initialReportDraft.aiSuggestions,
      visualRecognition: scenario.visualRecognition as typeof original.initialReportDraft.visualRecognition,
    });
    const [locationDraft, setLocation] = useState<typeof original.initialLocationDraft>({ ...original.initialLocationDraft,
      confidence: "dive_site_only", selectedSessionId: "one",
      sessions: [{ id: "one", backendId: 1, namedDiveSiteId: 1, site: "Reef" }],
    });
    return { reportDraft, locationDraft, resetReportDraft: () => {
      setReport(original.initialReportDraft);
      setLocation(original.initialLocationDraft);
    }, updateReportDraft: (changes: Partial<typeof original.initialReportDraft>) => setReport((current) => ({ ...current, ...changes })) };
  } };
});

beforeEach(() => {
  vi.clearAllMocks();
  scenario.aiSuggestions = [];
  scenario.visualRecognition = null;
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
  vi.mocked(loadDraftPhotos).mockResolvedValue([{ id: "one", file: new File(["photo"], "reef.jpg") }]);
  vi.mocked(clearDraftPhotos).mockResolvedValue(undefined);
  vi.mocked(getThreatCategories).mockResolvedValue([
    { threatCategoryId: 101, code: "ghost_gear", label: "Ghost fishing gear", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    { threatCategoryId: 105, code: "unsure", label: "Unsure", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
    { threatCategoryId: 103, code: "marine_debris", label: "Marine debris", shortExplanation: "", usefulEvidence: "", safetyReminder: "", iconReference: null },
  ]);
  vi.mocked(reviewReport).mockImplementation(async (payload) => {
    const unresolvedSuggestions = payload.aiSuggestions.filter((suggestion) => suggestion.status === "unresolved");
    return {
      isSubmittable: unresolvedSuggestions.length === 0,
      completeness: { isSubmittable: true, blockingMissing: [], blockingIssues: [], recommendedMissing: [], summary: "Ready to submit." },
      unresolvedSuggestions,
      report: {},
      evidence: [],
      locationWarning: null,
    };
  });
  vi.mocked(submitReport).mockResolvedValue({ reportReference: "RC-1", status: "received", submittedAt: "2026-09-11T10:00:00Z", generalLocation: "Reef" });
});

it("puts the location privacy explanation in its own box below the submission checklist", async () => {
  render(<ReportReview />);
  const privacyHeading = screen.getByRole("heading", { name: "Your location stays protected" });
  expect(privacyHeading).toBeInTheDocument();
  expect(privacyHeading.closest("aside")).toBeNull();
  expect(screen.getByRole("heading", { name: "Before submitting" }).closest("aside")).toBeInTheDocument();
  expect(screen.getByText(/Other coordinators and administrators see only the general site/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
});

it("shows success rather than missing fields while navigation is pending after resetting drafts", async () => {
  render(<ReportReview />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Report submitted");
  expect(screen.queryByText("Observation summary")).not.toBeInTheDocument();
});

it("still navigates to confirmation when local photo cleanup fails after API success", async () => {
  vi.mocked(clearDraftPhotos).mockRejectedValue(new Error("Storage unavailable"));
  render(<ReportReview />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("accepts all non-conflicting AI suggestions together at final review", async () => {
  scenario.aiSuggestions = [{
    source: "smart_report",
    field: "approximate_size",
    label: "Approximate size",
    suggestedValue: "5-10 m",
    confidence: null,
    status: "unresolved",
    conflict: false,
    observerValue: null,
  }];
  render(<ReportReview />);

  const acceptAll = await screen.findByRole("button", { name: "Accept AI suggestions" });
  expect(screen.getByText("AI suggested")).toBeInTheDocument();
  fireEvent.click(acceptAll);

  await waitFor(() => expect(screen.queryByRole("button", { name: "Accept AI suggestions" })).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
  expect(screen.getByText("AI assisted - reviewed")).toBeInTheDocument();
});

it("blocks submission until a recognized image suggestion is explicitly resolved", async () => {
  scenario.visualRecognition = {
    photoId: "one",
    photoName: "reef.jpg",
    status: "recognized",
    suggestedThreatCode: "marine_debris",
    suggestedThreatLabel: "Marine debris",
    confidence: 0.87,
    warning: null,
    resolution: "unresolved",
  };
  render(<ReportReview />);

  expect(await screen.findByText("Image suggestion needs your decision")).toBeInTheDocument();
  expect(screen.getByText("High confidence (87%)")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "IMAGE ANALYSIS" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled());
  expect(screen.getByRole("link", { name: "Review image analysis" })).toHaveAttribute("href", "/report-a-reef");
});

it("keeps visual recognition failures non-blocking", async () => {
  scenario.visualRecognition = {
    photoId: "one",
    photoName: "reef.jpg",
    status: "unavailable",
    suggestedThreatCode: null,
    suggestedThreatLabel: null,
    confidence: null,
    warning: "Visual recognition is temporarily unavailable. You can continue the report manually.",
    resolution: "not_required",
  };
  render(<ReportReview />);

  expect(await screen.findByText(/temporarily unavailable/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
});

for (const resolution of ["accepted", "kept", "changed"] as const) {
  it(`shows a confirmation icon without asking again when the image decision is ${resolution}`, async () => {
    scenario.visualRecognition = { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "ghost_gear", suggestedThreatLabel: "Ghost fishing gear", confidence: 0.9, warning: null, resolution };
    scenario.aiSuggestions = [{ source: "smart_report", field: "possible_threat", label: "Possible threat type", suggestedValue: "Ghost fishing gear", confidence: null, status: "confirmed", conflict: false, observerValue: null }];
    render(<ReportReview />);
    expect(screen.getByRole("img", { name: "Image suggestion decision confirmed" })).toBeInTheDocument();
    expect(screen.queryByText(/You still need to confirm the final choice/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your selected threat category remains/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Initial status: Received/)).not.toBeInTheDocument();
    expect(screen.getByText("Your report will be sent to a Case Coordinator for review.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled());
  });
}
it("keeps the decision reminder and submission block for an unresolved image suggestion", async () => {
  scenario.visualRecognition = { photoId: "one", photoName: "reef.jpg", status: "recognized", suggestedThreatCode: "ghost_gear", suggestedThreatLabel: "Ghost fishing gear", confidence: null, warning: null, resolution: "unresolved" };
  scenario.aiSuggestions = [{ source: "smart_report", field: "possible_threat", label: "Possible threat type", suggestedValue: "Ghost fishing gear", confidence: null, status: "confirmed", conflict: false, observerValue: null }];
  render(<ReportReview />);
  expect(screen.getByText(/You still need to confirm the final choice/)).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Image suggestion decision confirmed" })).not.toBeInTheDocument();
  await waitFor(() => expect(reviewReport).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();
});

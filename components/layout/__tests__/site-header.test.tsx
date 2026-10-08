import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectedReefSiteStorageKey } from "@/features/epic-02-reef-explorer/selected-site-storage";
import type { LocationDraft } from "@/features/shared/mock-app-state";
import type { ReportDraft } from "@/features/epic-02-reporting/types";
import { SiteHeader } from "../site-header";

const { push, refresh, resetReportDraft, clearDraftPhotos, appState } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  resetReportDraft: vi.fn(),
  clearDraftPhotos: vi.fn(),
  appState: { current: {} as Record<string, unknown> },
}));

const emptyReportDraft: ReportDraft = {
  threatCategoryCode: "",
  threatCategoryId: null,
  observationDate: "",
  observationTime: "",
  estimatedDepthMetres: "",
  description: "",
  photos: [],
  aiSuggestions: [],
  visualRecognition: null,
  lastSavedAt: null,
};

const emptyLocationDraft: LocationDraft = {
  step: "session",
  sessions: [],
  selectedSessionId: "",
  form: { site: "", label: "", date: "", start: "", end: "" },
  pin: null,
  locationSource: "dive_site",
  confidence: "",
  surfaceEntryContext: "",
  surfaceExitContext: "",
};

function setDraft(reportDraft: Partial<ReportDraft> = {}, options: { restored?: boolean; location?: Partial<LocationDraft> } = {}) {
  appState.current = {
    reportDraft: { ...emptyReportDraft, ...reportDraft },
    locationDraft: { ...emptyLocationDraft, ...options.location },
    isAccountDraftRestored: options.restored ?? true,
    resetReportDraft,
  };
}

const draftWithPhoto: Partial<ReportDraft> = {
  description: "Net tangled on the reef",
  photos: [{ id: "p1", name: "net.jpg", type: "image/jpeg", size: 1200 }],
};

function renderReportLink() {
  render(<SiteHeader navigation={[{ label: "Report a Reef", href: "/report-a-reef" }]} />);
  return screen.getByRole("link", { name: "Report a Reef" });
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/report-a-reef",
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => ({
    user: { id: 7, role: "observer", displayName: "Jamie Lee" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/features/shared/mock-app-state", () => ({
  useMockAppState: () => appState.current,
}));

vi.mock("@/features/epic-02-reporting/draft-storage", () => ({
  clearDraftPhotos,
}));

describe("SiteHeader report navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    clearDraftPhotos.mockResolvedValue(undefined);
    setDraft();
  });

  it("starts a fresh report and clears a Reef Explorer handoff", async () => {
    window.localStorage.setItem(selectedReefSiteStorageKey, JSON.stringify({ name: "D'Lagoon" }));
    render(<SiteHeader navigation={[{ label: "Report a Reef", href: "/report-a-reef" }]} />);

    await userEvent.click(screen.getByRole("link", { name: "Report a Reef" }));

    expect(resetReportDraft).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(selectedReefSiteStorageKey)).toBeNull();
    expect(clearDraftPhotos).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/report-a-reef");
      expect(refresh).toHaveBeenCalledOnce();
    });
  });

  it("asks before discarding a report in progress and continues it by default", async () => {
    setDraft(draftWithPhoto);
    await userEvent.click(renderReportLink());

    const dialog = screen.getByRole("dialog", { name: "You have a report in progress" });
    expect(dialog).toHaveTextContent("1 photo are saved");
    expect(within(dialog).getByRole("button", { name: "Continue report" })).toHaveFocus();
    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(clearDraftPhotos).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Continue report" }));

    expect(push).toHaveBeenCalledWith("/report-a-reef");
    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(clearDraftPhotos).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("treats progress through the location steps as a report in progress", async () => {
    setDraft({}, { location: { step: "privacy", selectedSessionId: "s1" } });
    await userEvent.click(renderReportLink());

    expect(screen.getByRole("dialog", { name: "You have a report in progress" })).toBeInTheDocument();
    expect(resetReportDraft).not.toHaveBeenCalled();
  });

  it("discards the draft only after the observer chooses to start again", async () => {
    setDraft(draftWithPhoto);
    await userEvent.click(renderReportLink());
    await userEvent.click(screen.getByRole("button", { name: "Discard and start new" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/report-a-reef"));
    expect(clearDraftPhotos).toHaveBeenCalledOnce();
    expect(resetReportDraft).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the draft and explains when stored photos cannot be cleared", async () => {
    setDraft(draftWithPhoto);
    clearDraftPhotos.mockRejectedValue(new Error("Storage unavailable"));
    await userEvent.click(renderReportLink());
    await userEvent.click(screen.getByRole("button", { name: "Discard and start new" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be cleared");
    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("closes the choice with Escape and returns focus to the link", async () => {
    setDraft(draftWithPhoto);
    const link = renderReportLink();
    await userEvent.click(link);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(link).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    expect(resetReportDraft).not.toHaveBeenCalled();
  });

  it("opens the form without clearing anything before the saved draft has loaded", async () => {
    setDraft({}, { restored: false });
    await userEvent.click(renderReportLink());

    expect(push).toHaveBeenCalledWith("/report-a-reef");
    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(clearDraftPhotos).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not reset a report when another navigation item is selected", async () => {
    render(<SiteHeader navigation={[{ label: "Explore", href: "/explore" }]} />);

    const exploreLink = screen.getByRole("link", { name: "Explore" });
    exploreLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await userEvent.click(exploreLink);

    expect(resetReportDraft).not.toHaveBeenCalled();
    expect(clearDraftPhotos).not.toHaveBeenCalled();
  });

  it("shows the signed-in user's display name instead of their role", () => {
    render(<SiteHeader navigation={[]} />);

    expect(screen.getByText("Jamie Lee")).toBeInTheDocument();
    expect(screen.getByLabelText("Signed in as Jamie Lee")).toBeInTheDocument();
    expect(screen.queryByText("Registered Observer")).not.toBeInTheDocument();
  });
});

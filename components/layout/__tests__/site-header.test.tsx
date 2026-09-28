import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectedReefSiteStorageKey } from "@/features/epic-02-reef-explorer/selected-site-storage";
import { SiteHeader } from "../site-header";

const { push, refresh, resetReportDraft, clearDraftPhotos } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  resetReportDraft: vi.fn(),
  clearDraftPhotos: vi.fn(),
}));

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
  useMockAppState: () => ({ resetReportDraft }),
}));

vi.mock("@/features/epic-02-reporting/draft-storage", () => ({
  clearDraftPhotos,
}));

describe("SiteHeader report navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    clearDraftPhotos.mockResolvedValue(undefined);
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

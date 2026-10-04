import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DivePlanner } from "../dive-planner";
import { getPlan, listPlans } from "@/lib/api/plansApi";
import { getPlanningDates, getPlanningSites } from "@/lib/api/planningApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: 7, displayName: "Observer", role: "observer" },
  }),
}));
vi.mock("@/lib/api/plansApi", () => ({
  listPlans: vi.fn(),
  getPlan: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
}));
vi.mock("@/lib/api/planningApi", () => ({
  getPlanningDates: vi.fn(),
  getPlanningSites: vi.fn(),
}));
vi.mock("../planning-panels", () => ({
  BriefPanel: () => null,
  DateComparison: () => <div>Date comparison</div>,
  Seasonality: () => <div>Seasonality</div>,
  AreaOverview: () => <div>Area overview</div>,
  SiteCard: () => <div>Site card</div>,
}));

const savedPlan = {
  planId: 12,
  name: "Redang dive plan",
  areaCode: "redang",
  plannedDate: "2026-10-10",
  diveSiteIds: [23, 21],
  createdAt: "2026-10-04T09:00:00Z",
  updatedAt: "2026-10-04T09:00:00Z",
};

describe("saved dive plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPlans).mockResolvedValue({ items: [savedPlan] });
    vi.mocked(getPlan).mockResolvedValue(savedPlan);
    vi.mocked(getPlanningDates).mockResolvedValue({
      areaCode: "redang",
      ruleVersion: "i3-v1",
      source: "forecast-provider",
      retrievedAt: "2026-10-04T09:10:00Z",
      days: [{
        date: "2026-10-10",
        band: "mixed",
        assessableSites: 4,
        totalSites: 4,
        breakdown: { moreFavourable: 2, mixed: 2, lessFavourable: 0 },
        reasons: [],
      }],
    });
    vi.mocked(getPlanningSites).mockResolvedValue({
      areaCode: "redang",
      date: "2026-10-10",
      ruleVersion: "i3-v1",
      source: "forecast-provider",
      retrievedAt: "2026-10-04T09:10:00Z",
      sites: [{
        diveSiteId: 23,
        siteName: "Mini Mount",
        band: "mixed",
        waveHeightMaxM: 1.1,
        windSpeedMaxKmh: 14,
        precipitationProbabilityMaxPct: 30,
        reason: "Moderate wind is forecast.",
      }],
    });
  });

  it("loads the owner list, reloads plan detail, and fetches current assessment on reopen", async () => {
    render(<DivePlanner />);
    fireEvent.click(screen.getByRole("button", { name: /My dive plans/ }));

    expect(await screen.findByText("Redang dive plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open plan" }));

    await waitFor(() => expect(getPlan).toHaveBeenCalledWith(12));
    expect(getPlanningDates).toHaveBeenCalledWith("redang", "2026-10-10", "2026-10-10");
    expect(getPlanningSites).toHaveBeenCalledWith("redang", "2026-10-10");
    expect(await screen.findByRole("heading", { name: "Refreshed conditions" })).toBeInTheDocument();
    expect(screen.getByText("Moderate wind is forecast.")).toBeInTheDocument();
  });
});

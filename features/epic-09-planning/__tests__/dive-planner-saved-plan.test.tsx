import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAreaDates, getAreaSites } from "@/lib/api/planningApi";
import { getPlan, listPlans } from "@/lib/api/plansApi";
import { addDays, localToday } from "../planning-data";

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
  getAreaSeasonality: vi.fn(),
  getAreaDates: vi.fn(),
  getAreaSites: vi.fn(),
  createPlanningBrief: vi.fn(),
}));
vi.mock("../planning-panels", () => ({
  BriefPanel: () => null,
  DateComparison: () => <div>Date comparison</div>,
  LoadError: () => null,
  Seasonality: () => <div>Seasonality</div>,
  AreaOverview: () => <div>Area overview</div>,
  SiteCard: () => <div>Site card</div>,
}));

const plannedDate = addDays(localToday(), 3);
const savedPlan = {
  planId: 12,
  name: "Redang dive plan",
  areaCode: "redang",
  plannedDate,
  diveSiteIds: [23, 21],
  createdAt: "2026-10-04T09:00:00Z",
  updatedAt: "2026-10-04T09:00:00Z",
};

async function renderPlanner(beforeRender?: () => Promise<void>) {
  vi.stubEnv("NEXT_PUBLIC_E9_DATA_SOURCE", "api");
  vi.resetModules();
  await beforeRender?.();
  const { DivePlanner } = await import("../dive-planner");
  render(<DivePlanner />);
  fireEvent.click(screen.getByRole("button", { name: /My dive plans/ }));
  expect(await screen.findByText("Redang dive plan")).toBeInTheDocument();
}

describe("saved dive plans", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.mocked(listPlans).mockResolvedValue({ items: [savedPlan] });
    vi.mocked(getPlan).mockResolvedValue(savedPlan);
    vi.mocked(getAreaDates).mockResolvedValue({
      areaCode: "redang",
      ruleVersion: "i3-v1",
      retrievedAt: "2026-10-04T09:10:00Z",
      days: [],
    });
    vi.mocked(getAreaSites).mockResolvedValue({
      areaCode: "redang",
      date: plannedDate,
      ruleVersion: "i3-v1",
      retrievedAt: "2026-10-04T09:10:00Z",
      sites: [],
    });
  });

  it("reloads the saved intent on reopen and requests current conditions for it", async () => {
    await renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "Open plan" }));

    await waitFor(() => expect(getPlan).toHaveBeenCalledWith(12));
    expect(
      await screen.findByRole("heading", { name: "Redang dive plan" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No forecast was stored with this plan/)).toBeInTheDocument();
    await waitFor(() => expect(getAreaSites).toHaveBeenCalledWith("redang", plannedDate));
  });

  it("drops a plan that no longer exists instead of opening stale intent", async () => {
    await renderPlanner(async () => {
      // Use the same module instance as the freshly imported planner.
      const { ApiError } = await import("@/lib/api/client");
      vi.mocked(getPlan).mockRejectedValue(new ApiError("Plan not found", 404));
    });
    fireEvent.click(screen.getByRole("button", { name: "Open plan" }));

    expect(
      await screen.findByText("This dive plan no longer exists. It has been removed from your list."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Redang dive plan")).not.toBeInTheDocument();
  });
});

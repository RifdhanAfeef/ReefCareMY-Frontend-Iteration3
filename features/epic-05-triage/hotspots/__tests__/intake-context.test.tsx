import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HotspotIntakePage } from "../hotspot-intake";
import { HotspotCaseContext } from "../hotspot-context";
import { getHotspotContext, getHotspotIntake } from "@/lib/api/hotspotsApi";
import { claimReport } from "@/lib/api/coordinatorApi";
import { ApiError } from "@/lib/api/client";
import { assignedIntake, context, intake } from "./fixtures";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams("siteId=1") }));
vi.mock("@/lib/api/coordinatorApi", () => ({ claimReport: vi.fn() }));
vi.mock("@/lib/api/hotspotsApi", async (original) => ({ ...await original<typeof import("@/lib/api/hotspotsApi")>(), getHotspotIntake: vi.fn(), getHotspotContext: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getHotspotIntake).mockResolvedValue(intake);
  vi.mocked(getHotspotContext).mockResolvedValue(context);
  vi.mocked(claimReport).mockResolvedValue({ reportReference: intake.reportReference, owner: { id: 8, displayName: "Coordinator" }, statusCode: "claimed", statusLabel: "Claimed", claimedAt: "2026-09-13T09:00:00Z" });
});

it("only claims after an explicit click, rechecks ownership and then opens authorised review", async () => {
  render(<HotspotIntakePage reportReference={intake.reportReference} />);
  const button = await screen.findByRole("button", { name: "Claim and open report" });
  expect(claimReport).not.toHaveBeenCalled();
  expect(getHotspotContext).not.toHaveBeenCalled();
  await userEvent.click(button);
  await waitFor(() => expect(push).toHaveBeenCalledWith("/coordinator/reports/RC-TEST-001"));
  expect(getHotspotIntake).toHaveBeenCalledTimes(2);
  expect(claimReport).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Return to analysis" })).toHaveAttribute("href", "/coordinator/hotspots?siteId=1");
});

it("does not claim if ownership changed before confirmation", async () => {
  vi.mocked(getHotspotIntake).mockResolvedValueOnce(intake).mockResolvedValue(assignedIntake);
  render(<HotspotIntakePage reportReference={intake.reportReference} />);
  await userEvent.click(await screen.findByRole("button", { name: "Claim and open report" }));
  expect(await screen.findByText("Assigned to another coordinator")).toBeInTheDocument();
  expect(claimReport).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Open authorised review" })).not.toBeInTheDocument();
});

it("refreshes the permitted summary after an atomic claim conflict", async () => {
  vi.mocked(getHotspotIntake).mockResolvedValueOnce(intake).mockResolvedValueOnce(intake).mockResolvedValue(assignedIntake);
  vi.mocked(claimReport).mockRejectedValue(new ApiError("Claimed elsewhere", 409));
  render(<HotspotIntakePage reportReference={intake.reportReference} />);
  await userEvent.click(await screen.findByRole("button", { name: "Claim and open report" }));
  expect(await screen.findByText("Assigned to another coordinator")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Claim and open report" })).not.toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it("offers authorised review for an owned report without posting another claim", async () => {
  vi.mocked(getHotspotIntake).mockResolvedValue({ ...intake, nextAction: "review", ownership: "mine" });
  render(<HotspotIntakePage reportReference={intake.reportReference} />);
  expect(await screen.findByRole("link", { name: "Open authorised review" })).toHaveAttribute("href", "/coordinator/reports/RC-TEST-001");
  expect(claimReport).not.toHaveBeenCalled();
});

it("keeps historical closed reports without an owner at summary access", async () => {
  vi.mocked(getHotspotIntake).mockResolvedValue({ ...intake, nextAction: "restricted_summary", isClosed: true });
  render(<HotspotIntakePage reportReference={intake.reportReference} />);
  expect(await screen.findByText("Closed report with no current owner")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Claim and open report" })).not.toBeInTheDocument();
});

it("links case context to exactly the backend selection and its historical observation dates", async () => {
  render(<HotspotCaseContext reportReference={intake.reportReference} />);
  expect(await screen.findByRole("link", { name: /View area on hotspot map/ })).toHaveAttribute("href", "/coordinator/hotspots?siteId=1&observedFrom=2026-09-01&observedTo=2026-09-13&interval=week");
  expect(screen.getByText("Represented area")).toBeInTheDocument();
  expect(screen.getByText("Test Reef North")).toBeInTheDocument();
  expect(screen.getByText("Time period")).toBeInTheDocument();
  expect(screen.getByText("Reports in selection")).toBeInTheDocument();
  expect(screen.getByText("8 reports")).toBeInTheDocument();
  expect(screen.getByText(/not verified incidents or ecological risk/i)).toBeInTheDocument();
});

it("keeps case review available when area context fails and supports an independent retry", async () => {
  vi.mocked(getHotspotContext).mockRejectedValueOnce(new ApiError("Unavailable", 503));
  render(<><p>Authorised case controls</p><HotspotCaseContext reportReference={intake.reportReference} /></>);
  expect(await screen.findByText("Area context unavailable")).toBeInTheDocument();
  expect(screen.getByText("Authorised case controls")).toBeInTheDocument();
  expect(screen.queryByText("0 reports")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry area context" }));
  expect(await screen.findByText("8 reports")).toBeInTheDocument();
});

it("shows limited-data context without blocking the normal case review", async () => {
  vi.mocked(getHotspotContext).mockResolvedValue({
    ...context,
    state: "insufficient_data",
    message: "There are not enough reports for a reliable trend.",
    reportCount: 1,
  });
  render(<><p>Authorised case controls</p><HotspotCaseContext reportReference={intake.reportReference} /></>);
  expect(await screen.findByText("Limited area context")).toBeInTheDocument();
  expect(screen.getByText("There are not enough reports for a reliable trend.")).toBeInTheDocument();
  expect(screen.getByText("Authorised case controls")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View area on hotspot map/ })).toBeInTheDocument();
});

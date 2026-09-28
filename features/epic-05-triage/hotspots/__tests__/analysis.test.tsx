import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/api/hotspotsApi";
import { ApiError } from "@/lib/api/client";
import { HotspotAnalysisPage } from "../hotspot-page";
import { HotspotFilterForm } from "../hotspot-filters";
import { ReportingFrequency } from "../hotspot-charts";
import { HotspotReportList } from "../hotspot-reports";
import { analysis, emptyAnalysis, filters, options, reports, summary } from "./fixtures";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push }), useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("@/lib/api/hotspotsApi", async (original) => ({ ...await original<typeof api>(), getHotspotOptions: vi.fn(), getHotspotAnalysis: vi.fn(), getHotspotReports: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks(); navigation.query = "";
  vi.mocked(api.getHotspotOptions).mockResolvedValue(options);
  vi.mocked(api.getHotspotAnalysis).mockResolvedValue(analysis);
  vi.mocked(api.getHotspotReports).mockResolvedValue(reports);
});

describe("Geographic analysis", () => {
  it("shows named-site counts and Unsure without inventing map coordinates or claiming reports", async () => {
    render(<HotspotAnalysisPage />);
    expect(await screen.findByText("Reports at named sites")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore Test Reef North, 8 reports" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore the named-site counts/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Reported threats" })).getByText("Unsure")).toBeInTheDocument();
    expect(screen.getByText(/17:00 MYT/)).toBeInTheDocument();
    expect(api.getHotspotReports).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Inspect contributing reports/ }));
    expect(await screen.findByRole("link", { name: "Inspect report RC-TEST-001" })).toHaveAttribute("href", expect.stringContaining("/hotspots/reports/RC-TEST-001?observedFrom=2026-09-01"));
    expect(screen.queryByRole("button", { name: /Claim and open/ })).not.toBeInTheDocument();
  });
  it("applies a site with the same dates and interval", async () => {
    render(<HotspotAnalysisPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Explore Test Reef North, 8 reports" }));
    expect(navigation.push).toHaveBeenCalledWith("/coordinator/hotspots?siteId=1&observedFrom=2026-09-01&observedTo=2026-09-13&interval=week", { scroll: false });
  });
  it("shows no-match and insufficient-history states for a successful empty result", async () => {
    vi.mocked(api.getHotspotAnalysis).mockResolvedValue(emptyAnalysis);
    render(<HotspotAnalysisPage />);
    expect(await screen.findByText("No matching reports")).toBeInTheDocument();
    expect(screen.getByText(/insufficient history to show a trend/)).toBeInTheDocument();
    expect(screen.queryByText(/Analysis unavailable/i)).not.toBeInTheDocument();
  });
  it("distinguishes missing geographic data from an empty period", async () => {
    vi.mocked(api.getHotspotAnalysis).mockResolvedValue({ ...emptyAnalysis, state: "insufficient_data", dataQuality: { ...emptyAnalysis.dataQuality!, matchingReportCount: 3, excludedMissingSiteCount: 3 } });
    render(<HotspotAnalysisPage />);
    expect(await screen.findByText("Not enough usable geographic data")).toBeInTheDocument();
    expect(screen.queryByText("No matching reports")).not.toBeInTheDocument();
  });
  it("never renders successful-looking zero metrics after an API failure and supports retry", async () => {
    vi.mocked(api.getHotspotAnalysis).mockRejectedValueOnce(new ApiError("Unavailable", 503));
    render(<HotspotAnalysisPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Analysis unavailable");
    expect(screen.queryByText("Reports at named sites")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Reports at named sites")).toBeInTheDocument();
  });
  it("does not request analysis for invalid URL filters", async () => {
    navigation.query = "observedFrom=2026-09-01";
    render(<HotspotAnalysisPage />);
    expect(await screen.findByText("Check this analysis link")).toBeInTheDocument();
    expect(api.getHotspotAnalysis).not.toHaveBeenCalled();
  });
  it("keeps unavailable options recoverable", async () => {
    vi.mocked(api.getHotspotOptions).mockRejectedValue(new ApiError("Expired", 401));
    render(<HotspotAnalysisPage />);
    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(api.getHotspotAnalysis).not.toHaveBeenCalled();
  });
});

it("clears dependent area/site choices on region change and blocks an invalid date period", async () => {
  const apply = vi.fn();
  render(<HotspotFilterForm options={options} filters={{ ...filters, region: "Pahang", area: "Test Island", siteId: 1 }} onApply={apply} onReset={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("State / region"), "Sabah");
  expect(screen.getByLabelText("Island / area")).toHaveValue("");
  expect(screen.getByLabelText("Dive site")).toHaveValue("");
  expect(screen.queryByRole("option", { name: "Test Reef North" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Observed from"), { target: { value: "2026-09-20" } });
  await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/on or after/);
  expect(apply).not.toHaveBeenCalled();
});

it("retains a zero-count interval and labels partial intervals in the accessible frequency table", async () => {
  render(<ReportingFrequency summary={{ ...summary, frequency: summary.frequency.map((bucket, i) => ({ ...bucket, reportCount: i ? 0 : 5 })) }} filters={filters} />);
  await userEvent.click(screen.getByText("View interval counts"));
  const table = screen.getByRole("table");
  expect(within(table).getByText("0")).toBeInTheDocument();
  expect(within(table).getByText("Partial")).toBeInTheDocument();
});

it("paginates report intake with the active filters and flags a changed total", async () => {
  vi.mocked(api.getHotspotReports).mockResolvedValue({ ...reports, total: 21 });
  render(<HotspotReportList filters={filters} expectedTotal={12} />);
  expect(await screen.findByText(/activity has changed/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(api.getHotspotReports).toHaveBeenLastCalledWith(filters, 2, expect.any(AbortSignal)));
});

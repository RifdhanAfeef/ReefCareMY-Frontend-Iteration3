import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseHistoryPanel } from "../case-history-panel";
import * as api from "@/lib/api/coordinatorApi";
import type { CoordinatorCase, CoordinatorHistoryItem } from "@/lib/api/types";

vi.mock("@/lib/api/coordinatorApi");
const report: CoordinatorCase = {
  reportReference: "RC-2001", observerId: 4, threat: "Marine debris", description: "Debris observed",
  observedAt: "2026-10-01T08:00:00Z", estimatedDepthMetres: null, area: "Tioman", preciseLocation: null,
  statusCode: "closed_logged", statusLabel: "Closed — Logged for reference", submittedAt: "2026-10-01T09:00:00Z",
  owner: { id: 8, displayName: "Current coordinator" }, evidence: [],
  latestDecision: { responseType: "refer_or_share", decidedAt: "2026-10-02T10:00:00Z", notes: "Share for consideration." },
  informationExchange: [{ eventType: "info_provided", occurredAt: "2026-10-02T09:00:00Z", message: "Additional observer details", actorDisplayName: "Observer" }],
};
const closure: CoordinatorHistoryItem = {
  reportReference: report.reportReference, threatCategory: { code: "marine_debris", label: "Marine debris" },
  status: { code: "closed_logged", label: "Closed" }, submittedAt: report.submittedAt, closedAt: "2026-10-03T10:00:00Z",
  closureReason: { code: "logged_for_reference", label: "Logged for reference" }, closureNote: "Retained for site history.",
  wasReferred: true, referrals: [{ referredTo: "Conservation organisation", referredAt: "2026-10-02T11:00:00Z", note: "For consideration only", decidedByName: "Recording coordinator" }],
};
beforeEach(() => vi.resetAllMocks());

describe("recorded case history", () => {
  it("loads the matching closed record across pages and shows only its chronological updates", async () => {
    vi.mocked(api.getCoordinatorCaseHistory)
      .mockResolvedValueOnce({ items: [{ ...closure, reportReference: "RC-OTHER", closureNote: "OTHER PRIVATE CASE" }], page: 1, pageSize: 1, total: 2, appliedFilters: {} })
      .mockResolvedValueOnce({ items: [closure], page: 2, pageSize: 1, total: 2, appliedFilters: {} });
    render(<CaseHistoryPanel report={report} />);
    expect(await screen.findByText("Retained for site history.")).toBeInTheDocument();
    const events = screen.getAllByRole("listitem");
    expect(events.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Report submitted"), expect.stringContaining("Observer response received"),
      expect.stringContaining("Latest response decision: Shared for possible response"),
      expect.stringContaining("Referral recorded: Conservation organisation"), expect.stringContaining("Case closed: Logged for reference"),
    ]);
    expect(screen.queryByText("OTHER PRIVATE CASE")).not.toBeInTheDocument();
    expect(screen.getByText(/does not mean the recipient agreed to act/)).toBeInTheDocument();
    expect(api.getCoordinatorCaseHistory).toHaveBeenLastCalledWith({ page: 2, pageSize: 100 });
  });

  it("retains current case details and offers a retry if closure lookup fails", async () => {
    vi.mocked(api.getCoordinatorCaseHistory).mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ items: [closure], page: 1, pageSize: 100, total: 1, appliedFilters: {} });
    render(<CaseHistoryPanel report={report} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Closure and referral history could not be loaded.");
    expect(screen.getByText("Current coordinator")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
    expect(await screen.findByText("Retained for site history.")).toBeInTheDocument();
  });

  it("does not invent a closure when the exact case is absent", async () => {
    vi.mocked(api.getCoordinatorCaseHistory).mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, appliedFilters: {} });
    render(<CaseHistoryPanel report={report} />);
    expect(await screen.findByText("No closure details were returned for this report.")).toBeInTheDocument();
    expect(screen.queryByText(/Case closed:/)).not.toBeInTheDocument();
  });

  it("does not request closed history for an active case", () => {
    render(<CaseHistoryPanel report={{ ...report, statusCode: "under_review", statusLabel: "Under review", latestDecision: null }} />);
    expect(api.getCoordinatorCaseHistory).not.toHaveBeenCalled();
    expect(screen.queryByText(/Latest response decision/)).not.toBeInTheDocument();
  });

  it("stops loading further pages after the history view is closed", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof api.getCoordinatorCaseHistory>>) => void;
    vi.mocked(api.getCoordinatorCaseHistory).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<CaseHistoryPanel report={report} />);
    view.unmount();
    resolve({ items: [], page: 1, pageSize: 100, total: 200, appliedFilters: {} });
    await waitFor(() => expect(api.getCoordinatorCaseHistory).toHaveBeenCalledTimes(1));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as coordinatorApi from "@/lib/api/coordinatorApi";
import type { CoordinatorQueueResult } from "@/lib/api/types";
import { MyCasesWorkspace } from "../my-cases-workspace";

vi.mock("@/lib/api/coordinatorApi");
const mockedGetCoordinatorQueue = vi.mocked(coordinatorApi.getCoordinatorQueue);
const mockedGetCoordinatorCaseHistory = vi.mocked(coordinatorApi.getCoordinatorCaseHistory);

const owner = { id: 8, displayName: "Current Coordinator" };
const report: CoordinatorQueueResult["items"][number] = {
  reportReference: "RC-3001",
  threat: "Marine debris",
  area: "Redang Island",
  statusCode: "claimed",
  statusLabel: "Claimed",
  submittedAt: "2026-09-03T05:00:00Z",
  hoursInQueue: 1,
  priority: "high",
  priorityReasons: ["Reviewable evidence is available"],
  claimedAt: "2026-09-04T01:00:00Z",
  owner,
};

function signIn() {
  window.localStorage.setItem("reefcare.auth", JSON.stringify({
    accessToken: "coordinator-token",
    user: { ...owner, role: "case_coordinator" },
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  mockedGetCoordinatorQueue.mockReset();
  mockedGetCoordinatorCaseHistory.mockReset();
  signIn();
});

describe("Coordinator My Cases workspace", () => {
  it("derives owned cases from every queue page so claims work across devices", async () => {
    mockedGetCoordinatorQueue
      .mockResolvedValueOnce({
        items: [{ ...report, owner: { id: 9, displayName: "Another Coordinator" } }],
        page: 1,
        pageSize: 1,
        total: 2,
      })
      .mockResolvedValueOnce({
        items: [report],
        page: 2,
        pageSize: 1,
        total: 2,
      });

    render(<MyCasesWorkspace />);

    expect(await screen.findByRole("cell", { name: "RC-3001" })).toBeInTheDocument();
    expect(screen.getByText("Marine debris")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Reviewable evidence is available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Priority information for RC-3001" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Why this priority?");
    expect(screen.getByRole("link", { name: "Open case RC-3001" })).toHaveAttribute(
      "href",
      "/coordinator/reports/RC-3001",
    );
    expect(mockedGetCoordinatorQueue).toHaveBeenNthCalledWith(1, 1, 100);
    expect(mockedGetCoordinatorQueue).toHaveBeenNthCalledWith(2, 2, 1);
    expect(screen.queryByText("Another Coordinator")).not.toBeInTheDocument();
  });

  it("keeps planned and completed action-stage cases in the active workspace", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue({
      items: [
        {
          ...report,
          reportReference: "RC-PLANNED",
          statusCode: "response_planned",
          statusLabel: "Response Planned",
        },
        {
          ...report,
          reportReference: "RC-COMPLETE",
          statusCode: "response_complete",
          statusLabel: "Response Complete",
        },
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    });

    render(<MyCasesWorkspace />);

    expect(await screen.findByRole("cell", { name: "RC-PLANNED" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "RC-COMPLETE" })).toBeInTheDocument();
    expect(screen.getByText("Response Planned")).toBeInTheDocument();
    expect(screen.getByText("Response Complete")).toBeInTheDocument();
  });

  it("shows ten owned active cases per page and preserves pagination when switching tabs", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 23 }, (_, index) => ({ ...report, reportReference: `RC-${index + 4001}` }));
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [...items, { ...report, reportReference: "RC-FOREIGN", owner: { id: 9, displayName: "Another coordinator" } }], page: 1, pageSize: 100, total: 24 });
    mockedGetCoordinatorCaseHistory.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, appliedFilters: {} });
    render(<MyCasesWorkspace />);
    await screen.findByRole("cell", { name: "RC-4001" });
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(10);
    expect(screen.queryByText("RC-FOREIGN")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("cell", { name: "RC-4011" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Closed history" }));
    await screen.findByText("No closed cases match these filters");
    await user.click(screen.getByRole("button", { name: "Active cases 23" }));
    expect(screen.getByRole("cell", { name: "RC-4021" })).toBeInTheDocument();
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledTimes(1);
  });

  it("searches all owned active cases and never includes another coordinator's case", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 23 }, (_, index) => ({ ...report, reportReference: `RC-${4001 + index}` }));
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [...items, { ...report, reportReference: "RC-FOREIGN", owner: { id: 9, displayName: "Another coordinator" } }], page: 1, pageSize: 100, total: 24 });
    render(<MyCasesWorkspace />);
    await screen.findByRole("cell", { name: "RC-4001" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    const input = screen.getByRole("searchbox", { name: "Case number" });
    await user.type(input, "  rc-4023  {Enter}");
    expect(screen.getByRole("cell", { name: "RC-4023" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(1);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    await user.clear(input); await user.type(input, "FOREIGN");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText("No matching cases")).toBeInTheDocument();
    expect(screen.queryByText("RC-FOREIGN")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(10);
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledTimes(1);
  });

  it("searches every closed history page, paginates results locally, then restores normal paging", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 23 }, (_, index) => ({
      reportReference: `RC-${5001 + index}`, threatCategory: { code: "ghost_gear", label: "Ghost fishing gear" },
      status: { code: "closed_logged", label: "Closed" }, submittedAt: report.submittedAt,
      wasReferred: false, referrals: [],
    }));
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    mockedGetCoordinatorCaseHistory.mockImplementation(async ({ page = 1, pageSize = 10 } = {}) => {
      const returnedSize = pageSize === 100 ? 10 : pageSize;
      return { items: records.slice((page - 1) * returnedSize, page * returnedSize), page, pageSize: returnedSize, total: records.length, appliedFilters: {} };
    });
    render(<MyCasesWorkspace />);
    await user.click(screen.getByRole("button", { name: "Closed history" }));
    await screen.findByRole("cell", { name: "RC-5001" });
    const input = screen.getByRole("searchbox", { name: "Case number" });
    await user.type(input, "RC-5023{Enter}");
    expect(await screen.findByRole("cell", { name: "RC-5023" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })).toHaveLength(1);
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenLastCalledWith({ page: 3, pageSize: 10 });
    await user.clear(input); await user.type(input, "rc-50{Enter}");
    await screen.findByRole("cell", { name: "RC-5001" });
    const count = mockedGetCoordinatorCaseHistory.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("cell", { name: "RC-5011" })).toBeInTheDocument();
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenCalledTimes(count);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await screen.findByRole("cell", { name: "RC-5001" });
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it("shows an error when the shared queue cannot be loaded", async () => {
    mockedGetCoordinatorQueue.mockRejectedValue(new Error("Service unavailable."));

    render(<MyCasesWorkspace />);

    expect(await screen.findByText("Your cases are unavailable")).toBeInTheDocument();
  });

  it("shows the empty state when the queue has no cases owned by this coordinator", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue({
      items: [{ ...report, owner: { id: 9, displayName: "Another Coordinator" } }],
      page: 1,
      pageSize: 100,
      total: 1,
    });

    render(<MyCasesWorkspace />);

    expect(await screen.findByText("You have no claimed cases")).toBeInTheDocument();
    expect(screen.queryByText("Backend-verified cases")).not.toBeInTheDocument();
  });

  it("shows filterable closed-case and referral history from the coordinator history endpoint", async () => {
    const user = userEvent.setup();
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    mockedGetCoordinatorCaseHistory.mockResolvedValue({
      items: [{
        reportReference: "RC-1999",
        threatCategory: { code: "marine_debris", label: "Marine debris" },
        generalLocation: "Tioman Island",
        status: { code: "referred", label: "Shared for possible response" },
        submittedAt: "2026-08-01T04:00:00Z",
        closedAt: "2026-09-12T04:00:00Z",
        closureReason: { code: "referred_other_org", label: "Referred to another organisation" },
        closureNote: "Shared for consideration.",
        wasReferred: true,
        referrals: [{
          referredTo: "Marine Park Department",
          referredAt: "2026-09-11T04:00:00Z",
          note: "For consideration only.",
          decidedByName: "Current Coordinator",
        }],
      }],
      page: 1,
      pageSize: 10,
      total: 1,
      appliedFilters: {},
    });

    render(<MyCasesWorkspace />);
    await user.click(screen.getByRole("button", { name: "Closed history" }));

    expect(await screen.findByRole("cell", { name: "RC-1999" })).toBeInTheDocument();
    expect(screen.getAllByText("Referred to another organisation")).toHaveLength(2);
    expect(screen.getAllByText("Marine Park Department").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open history RC-1999" })).toHaveAttribute(
      "href",
      "/coordinator/reports/RC-1999",
    );
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });
});


describe("My Cases column sorting", () => {
  it("sorts all owned active cases by priority and claimed timestamp and resets the page", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 23 }, (_, index) => ({ ...report, reportReference: `RC-${index + 1}`, priority: index === 22 ? "high" : "low", claimedAt: index === 22 ? "2026-02-01T10:00:00Z" : "2026-01-31T10:00:00Z" }));
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [...items, { ...report, reportReference: "RC-FOREIGN", owner: { id: 9, displayName: "Another Coordinator" } }], page: 1, pageSize: 100, total: 24 });
    render(<MyCasesWorkspace />);
    await screen.findByRole("cell", { name: "RC-1" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Sort by Priority" }));
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })[0]).toHaveTextContent("RC-23");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sort by Claimed" }));
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })[0]).toHaveTextContent("RC-23");
    expect(screen.getByRole("button", { name: "Sort by Claimed" }).closest("th")).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: "Sort by Claimed" }));
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })[0]).toHaveTextContent("RC-1");
    await user.click(screen.getByRole("button", { name: "Reset sorting" }));
    expect(screen.queryByText("RC-FOREIGN")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open case RC-/ })).toHaveLength(10);
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledTimes(1);
  });

  it("sorts closed history across backend pages and reuses the full result set for search and other columns", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 23 }, (_, index) => ({ reportReference: `RC-${index + 1}`, threatCategory: { code: "ghost_gear", label: "Ghost fishing gear" }, status: { code: "closed_logged", label: "Closed" }, submittedAt: report.submittedAt, closedAt: index === 22 ? "2026-02-01T10:00:00Z" : "2026-01-31T10:00:00Z", wasReferred: false, referrals: [] }));
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    mockedGetCoordinatorCaseHistory.mockImplementation(async ({ page = 1 } = {}) => ({ items: records.slice((page - 1) * 10, page * 10), page, pageSize: 10, total: records.length, appliedFilters: {} }));
    render(<MyCasesWorkspace />);
    await user.click(screen.getByRole("button", { name: "Closed history" }));
    await screen.findByRole("cell", { name: "RC-1" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("cell", { name: "RC-11" });
    await user.click(screen.getByRole("button", { name: "Sort by Closed" }));
    await screen.findByRole("cell", { name: "RC-23" });
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })[0]).toHaveTextContent("RC-23");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenLastCalledWith({ page: 3, pageSize: 10 });
    const calls = mockedGetCoordinatorCaseHistory.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Sort by Report" }));
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })[1]).toHaveTextContent("RC-2");
    await user.click(screen.getByRole("button", { name: "Sort by Report" }));
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })[0]).toHaveTextContent("RC-23");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })[0]).toHaveTextContent("RC-13");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.queryByText("Loading closed cases…")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Case number" }), "RC-2{Enter}");
    expect(screen.getAllByRole("link", { name: /Open history RC-/ }).map((link) => link.textContent?.trim())).toEqual(["Open history RC-23", "Open history RC-22", "Open history RC-21", "Open history RC-20", "Open history RC-2"]);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByRole("link", { name: /Open history RC-/ })).toHaveLength(10);
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenCalledTimes(calls);
    await user.click(screen.getByRole("button", { name: "Reset sorting" }));
    await screen.findByRole("cell", { name: "RC-1" });
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
  });

  it("shows an error instead of sorting a partial history and can retry", async () => {
    const user = userEvent.setup();
    const records = Array.from({ length: 11 }, (_, index) => ({ reportReference: `RC-${index + 1}`, threatCategory: { code: "ghost_gear", label: "Ghost fishing gear" }, status: { code: "closed_logged", label: "Closed" }, submittedAt: report.submittedAt, wasReferred: false, referrals: [] }));
    let fail = true;
    mockedGetCoordinatorQueue.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    mockedGetCoordinatorCaseHistory.mockImplementation(async ({ page = 1 } = {}) => {
      if (page === 2 && fail) throw new Error("Second page unavailable");
      return { items: records.slice((page - 1) * 10, page * 10), page, pageSize: 10, total: records.length, appliedFilters: {} };
    });
    render(<MyCasesWorkspace />);
    await user.click(screen.getByRole("button", { name: "Closed history" }));
    await screen.findByRole("cell", { name: "RC-1" });
    await user.click(screen.getByRole("button", { name: "Sort by Report" }));
    await screen.findByText("Closed history is unavailable");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("cell", { name: "RC-1" });
    expect(screen.getByText("Showing 1–10 of 11 cases")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Closure reason"), "logged_for_reference");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(mockedGetCoordinatorCaseHistory).toHaveBeenLastCalledWith(expect.objectContaining({ closureReason: "logged_for_reference", page: 2 })));
    await screen.findByRole("cell", { name: "RC-1" });
  });
});

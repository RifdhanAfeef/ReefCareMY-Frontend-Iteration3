import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
      pageSize: 20,
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
    expect(mockedGetCoordinatorCaseHistory).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
});

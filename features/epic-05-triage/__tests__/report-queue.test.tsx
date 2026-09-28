import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportQueue } from "../report-queue";
import * as coordinatorApi from "@/lib/api/coordinatorApi";
import type { CoordinatorQueueResult } from "@/lib/api/types";

vi.mock("@/lib/api/coordinatorApi");
const mockedGetCoordinatorQueue = vi.mocked(coordinatorApi.getCoordinatorQueue);

beforeEach(() => {
  mockedGetCoordinatorQueue.mockReset();
  window.localStorage.clear();
});

function resultOf(
  items: CoordinatorQueueResult["items"],
  page = 1,
  total = items.length,
  pageSize = 20,
): CoordinatorQueueResult {
  return { items, page, pageSize, total };
}

const report = {
  reportReference: "RC-1001",
  threat: "Ghost fishing gear",
  area: "Tioman Island",
  statusCode: "received" as const,
  statusLabel: "Received",
  submittedAt: "2026-09-04T02:00:00Z",
  hoursInQueue: 3,
};

describe("Coordinator report queue", () => {
  it("renders the reports returned by the backend queue endpoint", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([report]));

    render(<ReportQueue />);

    expect(
      await screen.findByRole("link", { name: "Review and claim RC-1001" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ghost fishing gear")).toBeInTheDocument();
    expect(screen.getAllByText("Tioman Island")).toHaveLength(2);
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledWith(1, 100);
  });

  it("loads all backend pages, then paginates the complete queue locally", async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      ...report,
      reportReference: `RC-${String(index + 1001).padStart(4, "0")}`,
    }));
    mockedGetCoordinatorQueue
      .mockResolvedValueOnce(resultOf(firstPage, 1, 21))
      .mockResolvedValueOnce(
        resultOf(
          [{ ...report, reportReference: "RC-1021", area: "Redang Island" }],
          2,
          21,
        ),
      );

    render(<ReportQueue />);
    expect(
      await screen.findByRole("link", { name: "Review and claim RC-1001" }),
    ).toBeInTheDocument();

    expect(mockedGetCoordinatorQueue).toHaveBeenNthCalledWith(2, 2, 100);
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByRole("link", { name: "Review and claim RC-1021" }),
    ).toBeInTheDocument();
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledTimes(2);
  });

  it("shows the backend error and allows the request to be retried", async () => {
    const user = userEvent.setup();
    mockedGetCoordinatorQueue
      .mockRejectedValueOnce(new Error("Unable to reach the coordinator API."))
      .mockResolvedValueOnce(resultOf([]));

    render(<ReportQueue />);

    expect(await screen.findByText("The report queue could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No reports were returned")).toBeInTheDocument();
    expect(mockedGetCoordinatorQueue).toHaveBeenCalledTimes(2);
  });

  it("renders claimed reports and lets the current owner reopen their case", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      accessToken: "coordinator-token",
      user: { id: 8, displayName: "Current Coordinator", role: "case_coordinator" },
    }));
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([
      {
        ...report,
        statusCode: "claimed",
        statusLabel: "Claimed",
        owner: { id: 8, displayName: "Current Coordinator" },
        claimedAt: "2026-09-04T03:00:00Z",
      },
      {
        ...report,
        reportReference: "RC-1002",
        statusCode: "under_review",
        statusLabel: "Under Review",
        owner: { id: 9, displayName: "Another Coordinator" },
        claimedAt: "2026-09-04T03:10:00Z",
      },
    ]));

    render(<ReportQueue />);

    await user.selectOptions(await screen.findByLabelText("Ownership"), "all");

    expect(await screen.findByRole("link", { name: "View claimed case RC-1001" })).toHaveAttribute(
      "href",
      "/coordinator/reports/RC-1001",
    );
    expect(screen.getByText("Another Coordinator")).toBeInTheDocument();
    expect(screen.getByText("Under Review")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Ownership"), "mine");
    expect(screen.getByRole("link", { name: "View claimed case RC-1001" })).toBeInTheDocument();
    expect(screen.queryByText("Another Coordinator")).not.toBeInTheDocument();
  });

  it("recalculates counts and page controls for the active ownership filter", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      accessToken: "coordinator-token",
      user: { id: 8, displayName: "Current Coordinator", role: "case_coordinator" },
    }));
    const allReports = Array.from({ length: 24 }, (_, index) => ({
      ...report,
      reportReference: `RC-${String(index + 1).padStart(4, "0")}`,
      ...(index < 2 ? {
        statusCode: "claimed" as const,
        statusLabel: "Claimed",
        owner: { id: 8, displayName: "Current Coordinator" },
        claimedAt: "2026-09-04T03:00:00Z",
      } : {}),
    }));
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf(allReports, 1, 24, 100));

    render(<ReportQueue />);
    expect(await screen.findByText("Showing 1–20 of 22 reports")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Ownership"), "mine");

    expect(screen.getByText("2 reports")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 reports")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  });

  it("does not expose API-contract language when records are returned", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([report]));

    render(<ReportQueue />);

    expect(await screen.findByRole("link", { name: "Review and claim RC-1001" })).toBeInTheDocument();
    expect(screen.queryByText(/backend|endpoint/i)).not.toBeInTheDocument();
  });

  it("shows evidence completeness, priority and the transparent priority reasons", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([{
      ...report,
      evidenceCompleteness: "complete",
      evidenceCount: 2,
      priority: "high",
      priorityReasons: ["Reviewable evidence is available", "Report has waited more than 72 hours"],
    }]));

    render(<ReportQueue />);

    expect(await screen.findByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Priority information for RC-1001" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Why this priority?");
    expect(screen.getByText("Reviewable evidence is available")).toBeInTheDocument();
    expect(screen.getByText(/guidance, not a verdict/i)).toBeInTheDocument();
  });

  it("shows unclaimed reports by default", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([
      report,
      {
        ...report,
        reportReference: "RC-1002",
        owner: { id: 9, displayName: "Another Coordinator" },
        claimedAt: "2026-09-04T03:00:00Z",
      },
    ]));

    render(<ReportQueue />);

    expect(await screen.findByRole("heading", { name: "Unclaimed reports" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ownership")).toHaveValue("unclaimed");
    expect(screen.getByRole("cell", { name: "RC-1001" })).toBeInTheDocument();
    expect(screen.queryByText("RC-1002")).not.toBeInTheDocument();
  });

  it("orders reports from most recently submitted to oldest", async () => {
    mockedGetCoordinatorQueue.mockResolvedValue(resultOf([
      { ...report, reportReference: "RC-OLD", submittedAt: "2026-09-01T02:00:00Z", hoursInQueue: 80 },
      { ...report, reportReference: "RC-NEW", submittedAt: "2026-09-05T02:00:00Z", hoursInQueue: 2 },
      { ...report, reportReference: "RC-MIDDLE", submittedAt: "2026-09-03T02:00:00Z", hoursInQueue: 40 },
    ]));

    render(<ReportQueue />);

    const links = await screen.findAllByRole("link", { name: /Review and claim/ });
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Review and claim RC-NEW",
      "Review and claim RC-MIDDLE",
      "Review and claim RC-OLD",
    ]);
  });
});

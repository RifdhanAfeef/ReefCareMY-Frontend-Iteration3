import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyReportsList } from "../my-reports-list";
import * as reportsApi from "@/lib/api/reportsApi";
import type { MyReportsResult } from "@/lib/api/types";

vi.mock("@/lib/api/reportsApi");
const mockedGetMyReports = vi.mocked(reportsApi.getMyReports);

beforeEach(() => {
  mockedGetMyReports.mockReset();
});

function resultOf(items: MyReportsResult["items"], page = 1, total = items.length): MyReportsResult {
  return { items, page, pageSize: 20, total };
}

describe("US6.2 AC1 — observer sees their own reports", () => {
  it("renders one entry per report returned for the signed-in observer", async () => {
    mockedGetMyReports.mockResolvedValue(
      resultOf([
        {
          reportReference: "RC-0001",
          threatCategory: "Ghost fishing gear",
          generalLocation: "Reef A",
          status: "under_review",
          statusLabel: "Being reviewed",
          outcome: null,
          submittedAt: "2026-08-25T04:40:00Z",
        },
        {
          reportReference: "RC-0002",
          threatCategory: "Coral bleaching",
          generalLocation: "Reef B",
          status: "received",
          statusLabel: "Received",
          outcome: null,
          submittedAt: "2026-08-20T04:40:00Z",
        },
      ]),
    );

    render(<MyReportsList />);

    expect(await screen.findByText("RC-0001")).toBeInTheDocument();
    expect(screen.getByText("RC-0002")).toBeInTheDocument();
    expect(mockedGetMyReports).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it("loads later pages instead of stopping after the first 20 reports", async () => {
    const user = userEvent.setup();
    mockedGetMyReports
      .mockResolvedValueOnce(resultOf([{ reportReference: "RC-0020", threatCategory: "Marine debris", generalLocation: "Reef A", status: "received", statusLabel: "Received", outcome: null, submittedAt: "2026-08-25T04:40:00Z" }], 1, 21))
      .mockResolvedValueOnce(resultOf([{ reportReference: "RC-0021", threatCategory: "Coral bleaching", generalLocation: "Reef B", status: "received", statusLabel: "Received", outcome: null, submittedAt: "2026-08-26T04:40:00Z" }], 2, 21));

    render(<MyReportsList />);
    expect(await screen.findByText("RC-0020")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("RC-0021")).toBeInTheDocument();
    expect(mockedGetMyReports).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });
});

describe("US6.2 AC3 — closure reason is visible", () => {
  it("shows the outcome text for a closed report", async () => {
    mockedGetMyReports.mockResolvedValue(
      resultOf([
        {
          reportReference: "RC-0176",
          threatCategory: "Marine debris",
          generalLocation: "Reef C",
          status: "closed_no_partner",
          statusLabel: "Closed",
          outcome: "Recorded, no active response programme currently covers this site",
          submittedAt: "2026-08-10T02:05:00Z",
        },
      ]),
    );

    render(<MyReportsList />);

    expect(
      await screen.findByText(
        "Recorded, no active response programme currently covers this site",
      ),
    ).toBeInTheDocument();
  });
});

describe("US6.2 AC4 — no internal jargon is leaked", () => {
  it("renders whatever observer-facing label the backend sends, unchanged", async () => {
    mockedGetMyReports.mockResolvedValue(
      resultOf([
        {
          reportReference: "RC-9999",
          threatCategory: "Physical reef damage",
          generalLocation: "Reef D",
          status: "evidence_accepted",
          statusLabel: "Evidence accepted as a valid report",
          outcome: null,
          submittedAt: "2026-08-05T00:00:00Z",
        },
      ]),
    );

    render(<MyReportsList />);

    expect(
      await screen.findByText("Evidence accepted as a valid report"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/evidence_accepted/i)).not.toBeInTheDocument();
  });
});

describe("US6.2 AC5 — status updates are reflected promptly", () => {
  it("shows the latest status the next time My Reports is opened", async () => {
    mockedGetMyReports.mockResolvedValueOnce(
      resultOf([
        {
          reportReference: "RC-0241",
          threatCategory: "Ghost fishing gear",
          generalLocation: "Reef A",
          status: "claimed",
          statusLabel: "A case coordinator has your report",
          outcome: null,
          submittedAt: "2026-08-25T04:40:00Z",
        },
      ]),
    );

    const { unmount } = render(<MyReportsList />);
    expect(
      await screen.findByText("A case coordinator has your report"),
    ).toBeInTheDocument();
    unmount();

    mockedGetMyReports.mockResolvedValueOnce(
      resultOf([
        {
          reportReference: "RC-0241",
          threatCategory: "Ghost fishing gear",
          generalLocation: "Reef A",
          status: "under_review",
          statusLabel: "Being reviewed",
          outcome: null,
          submittedAt: "2026-08-25T04:40:00Z",
        },
      ]),
    );

    render(<MyReportsList />);
    expect(await screen.findByText("Being reviewed")).toBeInTheDocument();
  });
});

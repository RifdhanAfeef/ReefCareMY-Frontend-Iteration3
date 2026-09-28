import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportConfirmation } from "../report-confirmation";
import { formatDateTime } from "@/lib/format/date";

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

describe("US6.1 — report confirmation", () => {
  it("shows the report ID, threat type, location, submission date and status from the URL", () => {
    mockSearchParams = new URLSearchParams({
      reportReference: "RC-0241",
      status: "received",
      submittedAt: "2026-08-28T16:37:19.091Z",
      generalLocation: "Tiger Reef, Tioman Island",
      threatCategory: "Ghost fishing gear",
    });

    render(<ReportConfirmation />);

    expect(screen.getByText("RC-0241")).toBeInTheDocument();
    expect(screen.getByText("Ghost fishing gear")).toBeInTheDocument();
    expect(screen.getByText("Tiger Reef, Tioman Island")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(
      screen.getByText(formatDateTime(new Date("2026-08-28T16:37:19.091Z"))),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What happens next?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View this report" })).toHaveAttribute(
      "href",
      "/my-reports/RC-0241",
    );
  });

  it("shows a fallback instead of guessing when opened without submission data", () => {
    mockSearchParams = new URLSearchParams();

    render(<ReportConfirmation />);

    expect(screen.getByText(/don't have your submission details/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my reports/i })).toHaveAttribute(
      "href",
      "/my-reports",
    );
  });
});


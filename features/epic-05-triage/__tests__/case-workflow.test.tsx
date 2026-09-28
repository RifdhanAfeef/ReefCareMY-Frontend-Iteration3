import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoordinatorCaseRoute } from "../case-workflow";
import * as coordinatorApi from "@/lib/api/coordinatorApi";
import { ApiError } from "@/lib/api/client";
import type { CoordinatorCase } from "@/lib/api/types";

vi.mock("@/lib/api/coordinatorApi");
// Area context has independent requests and its own failure/permission tests.
vi.mock("../hotspots/hotspot-context", () => ({ HotspotCaseContext: () => null }));

const mockedClaimReport = vi.mocked(coordinatorApi.claimReport);
const mockedCloseCase = vi.mocked(coordinatorApi.closeCase);
const mockedGetCoordinatorCase = vi.mocked(coordinatorApi.getCoordinatorCase);
const mockedGetCoordinatorEvidence = vi.mocked(coordinatorApi.getCoordinatorEvidence);
const mockedGetConservationActions = vi.mocked(coordinatorApi.getConservationActions);
const mockedGetConservationActionTypes = vi.mocked(coordinatorApi.getConservationActionTypes);
const mockedRecordEvidenceAssessment = vi.mocked(coordinatorApi.recordEvidenceAssessment);
const mockedRecordCaseDecision = vi.mocked(coordinatorApi.recordCaseDecision);
const mockedRequestMoreInformation = vi.mocked(coordinatorApi.requestMoreInformation);
const mockedStartReview = vi.mocked(coordinatorApi.startReview);

const report: CoordinatorCase = {
  reportReference: "RC-2001",
  observerId: 14,
  threat: "Ghost fishing gear",
  description: "A net is caught across the reef.",
  observedAt: "2026-09-03T04:15:00Z",
  estimatedDepthMetres: 12,
  area: "Tioman Island",
  preciseLocation: {
    latitude: 2.7902,
    longitude: 104.1698,
    uncertaintyMetres: 25,
    confidenceLabel: "Within 100 m",
    sourceLabel: "Observer map pin",
    relocationNotes: "Surface entry context: Entered from the northern boat mooring\nSurface exit context: Surfaced beside the jetty",
  },
  statusCode: "under_review",
  statusLabel: "Under Review",
  submittedAt: "2026-09-03T05:00:00Z",
  owner: { id: 8, displayName: "Case Coordinator" },
  evidence: [{ evidenceId: 13, mediaType: "photo", uploadedAt: "2026-09-03T04:20:00Z" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:reef-evidence") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  mockedGetCoordinatorCase.mockResolvedValue(report);
  mockedGetCoordinatorEvidence.mockResolvedValue(new Blob(["image"], { type: "image/jpeg" }));
  mockedGetConservationActionTypes.mockResolvedValue([]);
  mockedGetConservationActions.mockResolvedValue({ reportReference: report.reportReference, items: [], total: 0 });
  mockedClaimReport.mockResolvedValue({
    reportReference: report.reportReference,
    owner: report.owner,
    statusCode: "claimed",
    statusLabel: "Claimed",
    claimedAt: "2026-09-04T01:00:00Z",
  });
  mockedRequestMoreInformation.mockResolvedValue({
    reportReference: report.reportReference,
    status: "needs_more_info",
    reason: "Please add more detail.",
    requestedAt: "2026-09-04T01:10:00Z",
  });
  mockedStartReview.mockResolvedValue({
    reportReference: report.reportReference,
    statusCode: "under_review",
  });
  mockedRecordEvidenceAssessment.mockResolvedValue({
    reportReference: report.reportReference,
    evidenceUsable: true,
    observationCredible: true,
    status: "evidence_accepted",
    assessedAt: "2026-09-04T01:15:00Z",
    assessedBy: report.owner.id,
  });
  mockedRecordCaseDecision.mockResolvedValue({
    reportReference: report.reportReference,
    responseType: "monitoring_only",
    decidedAt: "2026-09-04T01:20:00Z",
    decidedBy: report.owner.id,
  });
  mockedCloseCase.mockResolvedValue({
    reportReference: report.reportReference,
    status: "closed_no_action",
    closureReasonCode: "monitored_no_action",
    closedAt: "2026-09-04T01:30:00Z",
  });
});

describe("Coordinator case workflow", () => {
  it("loads and displays protected evidence automatically with the case", async () => {
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("link", { name: "← Back to My Cases" })).toHaveAttribute("href", "/coordinator/my-cases");
    expect(await screen.findByRole("img", { name: "Submitted evidence 13" })).toHaveAttribute("src", "blob:reef-evidence");
    expect(mockedGetCoordinatorEvidence).toHaveBeenCalledWith(report.reportReference, 13);
    expect(screen.queryByRole("button", { name: /open evidence/i })).not.toBeInTheDocument();
    expect(screen.getByText(/03\/09\/2026, \d{1,2}:20 [AP]M/)).toBeInTheDocument();
    expect(screen.queryByText("2026-09-03T04:20:00Z")).not.toBeInTheDocument();
    expect(screen.getByText("Submitted location")).toBeInTheDocument();
    expect(screen.getByText("Confidence: Within 100 m")).toBeInTheDocument();
    expect(screen.getByText("Source: Observer map pin")).toBeInTheDocument();
    expect(screen.getByText("Surface entry and exit context")).toBeInTheDocument();
    expect(screen.getByText(/Entered from the northern boat mooring/)).toBeInTheDocument();
    expect(screen.getByText(/not an exact underwater location/i)).toBeInTheDocument();
    expect(screen.queryByText("Authorised exact location")).not.toBeInTheDocument();
  });

  it("keeps coordinator action evidence inside action history instead of Observer submitted evidence", async () => {
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      latestDecision: {
        responseType: "intervention_required",
        notes: "A clean-up response is recommended.",
        referredTo: null,
      },
      evidence: [
        ...report.evidence,
        { evidenceId: 19, mediaType: "image/jpeg", uploadedAt: "2026-09-17T14:15:00Z" },
      ],
    });
    mockedGetConservationActionTypes.mockResolvedValueOnce([
      { code: "reef_cleanup", label: "Reef clean-up", description: null },
    ]);
    mockedGetConservationActions.mockResolvedValueOnce({
      reportReference: report.reportReference,
      total: 1,
      items: [{
        caseActionId: 6,
        reportReference: report.reportReference,
        actionTypeCode: "reef_cleanup",
        actionTypeLabel: "Reef clean-up",
        actionState: "action_taken",
        actionDate: "2026-09-17",
        responsibleTeam: "Team 18",
        notes: "Debris has been removed.",
        statusCode: "response_complete",
        createdBy: 8,
        createdByName: "Case Coordinator",
        createdAt: "2026-09-17T14:15:00Z",
        evidence: [{ evidenceId: 19, mediaType: "image/jpeg", uploadedAt: "2026-09-17T14:15:00Z", caseActionId: 6 }],
      }],
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("img", { name: "Submitted evidence 13" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Action evidence 1 for Reef clean-up" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Submitted evidence 19" })).not.toBeInTheDocument();
  });

  it("renders the backend information-exchange event list for re-review", async () => {
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      informationExchange: [
        {
          eventType: "info_requested",
          message: "Please describe the size of the net.",
          occurredAt: "2026-09-04T01:10:00Z",
          actorUserId: 8,
          actorDisplayName: "Coordinator One",
        },
        {
          eventType: "info_provided",
          message: "The net was approximately three metres wide.",
          occurredAt: "2026-09-05T02:20:00Z",
          actorUserId: 14,
          actorDisplayName: "Jamie Lee",
        },
      ],
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("heading", { name: "Information request and response" })).toBeInTheDocument();
    expect(screen.getByText("Coordinator request")).toBeInTheDocument();
    expect(screen.getByText("Please describe the size of the net.")).toBeInTheDocument();
    expect(screen.getByText("Observer response")).toBeInTheDocument();
    expect(screen.getByText("The net was approximately three metres wide.")).toBeInTheDocument();
    expect(screen.getByText(/Coordinator One/)).toBeInTheDocument();
    expect(screen.getByText(/Jamie Lee/)).toBeInTheDocument();
  });

  it("shows only Observer-reviewed AI-assisted fields and never presents model output as verification", async () => {
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      aiAssisted: {
        available: true,
        source: "smart_report_structuring",
        isUnverifiedAiOutput: true,
        generatedAt: null,
        suggestions: [
          { field: "estimated_depth", label: "Estimated depth", value: "12 metres", status: "confirmed" },
          { field: "affected_area", label: "Affected area", value: "Branching coral", status: "corrected" },
        ],
      },
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("heading", { name: "Review reef observation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Observer-confirmed structured information" })).not.toBeInTheDocument();
    expect(screen.getByText("12 metres")).toBeInTheDocument();
    expect(screen.getByText("Branching coral")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted · accepted by Observer")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted · edited by Observer")).toBeInTheDocument();
    expect(screen.getByText(/do not independently verify that the reported threat is present/i)).toBeInTheDocument();
    expect(screen.getByText(/not Coordinator-confirmed findings/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI structuring completed/i)).not.toBeInTheDocument();
  });

  it("hides AI-assisted information for reports submitted before provenance was captured", async () => {
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      aiAssisted: {
        available: false,
        source: null,
        isUnverifiedAiOutput: true,
        generatedAt: null,
        suggestions: [],
      },
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("heading", { name: "Review reef observation" })).toBeInTheDocument();
    expect(screen.queryByText(/AI-assisted · accepted by Observer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-assisted values were reviewed/i)).not.toBeInTheDocument();
  });

  it("claims a queue report through the backend before loading protected details", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      accessToken: "coordinator-token",
      user: { id: report.owner.id, displayName: report.owner.displayName, role: "case_coordinator" },
    }));
    render(<CoordinatorCaseRoute reportReference={report.reportReference} startWithClaim />);

    expect(mockedGetCoordinatorCase).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Claim and open report" }));

    expect(await screen.findByRole("heading", { name: "Review reef observation" })).toBeInTheDocument();
    expect(mockedClaimReport).toHaveBeenCalledWith(report.reportReference);
    expect(mockedGetCoordinatorCase).toHaveBeenCalledWith(report.reportReference);
    expect(screen.getByText("photo")).toBeInTheDocument();
    expect(screen.getByText("2.790200, 104.169800")).toBeInTheDocument();
    expect(screen.getByText(/You can now begin reviewing its evidence/)).toBeInTheDocument();
  });

  it("keeps a successful claim accessible when the first detail request fails", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      accessToken: "coordinator-token",
      user: { id: report.owner.id, displayName: report.owner.displayName, role: "case_coordinator" },
    }));
    mockedGetCoordinatorCase
      .mockRejectedValueOnce(new Error("Temporary read failure."))
      .mockResolvedValueOnce(report);

    render(<CoordinatorCaseRoute reportReference={report.reportReference} startWithClaim />);
    await user.click(screen.getByRole("button", { name: "Claim and open report" }));

    expect(await screen.findByText(/The report was claimed successfully/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Review reef observation" })).toBeInTheDocument();
    expect(mockedClaimReport).toHaveBeenCalledTimes(1);
    expect(mockedGetCoordinatorCase).toHaveBeenCalledTimes(2);
  });

  it("moves a claimed case to under review before opening the assessment", async () => {
    const user = userEvent.setup();
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      statusCode: "claimed",
      statusLabel: "Claimed",
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    const startButton = await screen.findByRole("button", { name: "Start evidence assessment" });
    expect(screen.queryByRole("button", { name: "Request more information" })).not.toBeInTheDocument();
    expect(startButton).toBeEnabled();
    await user.click(startButton);
    expect(screen.getByRole("heading", { name: "Assess the submitted evidence" })).toBeInTheDocument();
    expect(mockedStartReview).toHaveBeenCalledWith(report.reportReference);
    expect(screen.getByLabelText(/Assessment note/)).toHaveValue("");
  });

  it("flags an omitted observedAt value instead of presenting it as observer-supplied missing data", async () => {
    mockedGetCoordinatorCase.mockResolvedValueOnce({ ...report, observedAt: null });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByText("Observation date could not be loaded")).toBeInTheDocument();
    expect(screen.getByText(/observation date is temporarily unavailable/i)).toBeInTheDocument();
  });

  it("records a Not Substantiated evidence outcome through the backend", async () => {
    const user = userEvent.setup();
    mockedRecordEvidenceAssessment.mockResolvedValueOnce({
      reportReference: report.reportReference,
      evidenceUsable: true,
      observationCredible: false,
      status: "closed_not_substantiated",
      assessedAt: "2026-09-04T01:15:00Z",
      assessedBy: report.owner.id,
    });
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("Yes — the evidence can be assessed"));
    await user.click(screen.getByLabelText("No — prepare a Not Substantiated closure"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Case outcome recorded" })).toBeInTheDocument();
    expect(mockedRecordEvidenceAssessment).toHaveBeenCalledWith(
      report.reportReference,
      expect.objectContaining({ evidenceUsable: true, observationCredible: false }),
    );
  });

  it("recovers when a conflicting Not Substantiated response was already committed", async () => {
    const user = userEvent.setup();
    mockedRecordEvidenceAssessment.mockRejectedValueOnce(new ApiError("The case status changed.", 409));
    mockedGetCoordinatorCase
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({
        ...report,
        statusCode: "closed_not_substantiated",
        statusLabel: "Closed — Not Substantiated",
      });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("Yes — the evidence can be assessed"));
    await user.click(screen.getByLabelText("No — prepare a Not Substantiated closure"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Case outcome recorded" })).toBeInTheDocument();
    expect(mockedGetCoordinatorCase).toHaveBeenCalledTimes(2);
  });

  it("records unusable evidence before showing the information-needed result", async () => {
    const user = userEvent.setup();
    mockedRecordEvidenceAssessment.mockResolvedValueOnce({
      reportReference: report.reportReference,
      evidenceUsable: false,
      observationCredible: null,
      status: "needs_more_info",
      assessedAt: "2026-09-04T01:15:00Z",
      assessedBy: report.owner.id,
    });
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("No — more information is required"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("heading", { name: "Information request sent" })).toBeInTheDocument();
    expect(mockedRecordEvidenceAssessment).toHaveBeenCalledWith(
      report.reportReference,
      expect.objectContaining({ evidenceUsable: false }),
    );
    expect(mockedRequestMoreInformation).not.toHaveBeenCalled();
  });

  it("records a monitoring decision and closure through the backend", async () => {
    const user = userEvent.setup();
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("Yes — the evidence can be assessed"));
    await user.click(screen.getByLabelText("Yes — continue to a response decision"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(mockedRecordEvidenceAssessment).toHaveBeenCalledWith(
      report.reportReference,
      expect.objectContaining({ evidenceUsable: true, observationCredible: true }),
    );
    await user.click(screen.getByLabelText(/Monitoring Only/));
    await user.click(screen.getByRole("button", { name: "Record response" }));

    expect(await screen.findByRole("heading", { name: "Response decision recorded" })).toBeInTheDocument();
    expect(mockedRecordCaseDecision).toHaveBeenCalledWith(
      report.reportReference,
      expect.objectContaining({ responseType: "monitoring_only" }),
    );
    expect(mockedRecordCaseDecision).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Record a closure outcome" }));
    expect(screen.getByLabelText(/Referred to another organisation/)).toBeDisabled();
    expect(screen.getByLabelText(/Monitored, no action required/)).toBeEnabled();
    expect(screen.getByLabelText(/Not substantiated/)).toBeDisabled();
    expect(screen.getByLabelText(/No responsible partner available/)).toBeDisabled();
    expect(screen.getByLabelText(/Logged for reference/)).toBeEnabled();
    await user.click(screen.getByLabelText(/Monitored, no action required/));
    await user.type(screen.getByLabelText("Public closure note *"), "Reviewed and retained for monitoring.");
    await user.click(screen.getByRole("button", { name: "Close case" }));

    expect(await screen.findByRole("heading", { name: "Case outcome recorded" })).toBeInTheDocument();
    expect(mockedCloseCase).toHaveBeenCalledWith(report.reportReference, {
      closureReasonCode: "monitored_no_action",
      publicClosureNote: "Reviewed and retained for monitoring.",
    });
  });

  it("restores a saved response decision and closure entry point after refresh", async () => {
    const user = userEvent.setup();
    const firstRender = render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("Yes — the evidence can be assessed"));
    await user.click(screen.getByLabelText("Yes — continue to a response decision"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByLabelText(/Monitoring Only/));
    await user.click(screen.getByRole("button", { name: "Record response" }));
    expect(await screen.findByRole("heading", { name: "Response decision recorded" })).toBeInTheDocument();

    firstRender.unmount();
    mockedGetCoordinatorCase.mockResolvedValue({
      ...report,
      statusCode: "evidence_accepted",
      statusLabel: "Evidence Accepted",
    });
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByRole("heading", { name: "Response decision recorded" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monitoring Recommended" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record a closure outcome" })).toBeEnabled();
  });

  it("opens the closure workflow from a response-complete case", async () => {
    const user = userEvent.setup();
    mockedGetCoordinatorCase.mockResolvedValueOnce({
      ...report,
      statusCode: "response_complete",
      statusLabel: "Response Complete",
      latestDecision: {
        responseType: "intervention_required",
        notes: "A clean-up response is recommended.",
        referredTo: null,
      },
    });

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    const closeButton = await screen.findByRole("button", { name: "Close case" });
    expect(closeButton).toBeEnabled();
    expect(screen.getByRole("button", { name: "Start evidence assessment" })).toBeDisabled();

    await user.click(closeButton);

    expect(await screen.findByRole("heading", { name: "Choose a closure reason" })).toBeInTheDocument();
    expect(screen.getByLabelText(/No responsible partner available/)).toBeEnabled();
    expect(screen.getByLabelText(/Logged for reference/)).toBeEnabled();
  });

  it("records the entered referral recipient as referredTo", async () => {
    const user = userEvent.setup();
    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    await user.click(await screen.findByRole("button", { name: "Start evidence assessment" }));
    await user.click(screen.getByLabelText("Yes — the evidence can be assessed"));
    await user.click(screen.getByLabelText("Yes — continue to a response decision"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByLabelText(/Refer \/ Share for Possible Response/));
    await user.click(screen.getByRole("button", { name: "Record response" }));
    await user.type(screen.getByLabelText("Recipient organisation or contact *"), "Tioman Marine Park Department");
    await user.click(screen.getByRole("button", { name: "Record referral" }));

    expect(mockedRecordCaseDecision).toHaveBeenCalledWith(
      report.reportReference,
      expect.objectContaining({
        responseType: "refer_or_share",
        referredTo: "Tioman Marine Park Department",
      }),
    );
  });

  it("shows backend load errors and retries the owned-case request", async () => {
    const user = userEvent.setup();
    mockedGetCoordinatorCase
      .mockRejectedValueOnce(new Error("You do not own this report."))
      .mockResolvedValueOnce(report);

    render(<CoordinatorCaseRoute reportReference={report.reportReference} />);

    expect(await screen.findByText("The case could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Review reef observation" })).toBeInTheDocument();
    expect(mockedGetCoordinatorCase).toHaveBeenCalledTimes(2);
  });
});

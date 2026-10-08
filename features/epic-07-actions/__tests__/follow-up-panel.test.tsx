import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpPanel } from "../follow-up-panel";
import * as api from "@/lib/api/iteration3Api";
import { ApiError } from "@/lib/api/client";
import type { FollowUp } from "@/lib/api/iteration3-types";
import * as coordinatorApi from "@/lib/api/coordinatorApi";

vi.mock("@/lib/api/iteration3Api");
vi.mock("@/lib/api/coordinatorApi");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getFollowUps).mockResolvedValue({ reportReference: "RC-1", items: [], total: 0, message: "No follow-up recorded." });
  vi.mocked(api.getMonitoringConditions).mockResolvedValue([
    { code: "stable", label: "Stable", description: null },
  ]);
  vi.mocked(coordinatorApi.getConservationActionTypes).mockResolvedValue([
    { code: "reef_cleanup", label: "Reef clean-up", description: null },
  ]);
  vi.mocked(api.createMonitoring).mockResolvedValue({ caseActionId: 8 } as never);
});

describe("follow-up and monitoring", () => {
  it("records a human-reviewed visit with no forced next date", async () => {
    render(<FollowUpPanel reportReference="RC-1" statusCode="evidence_accepted" />);
    expect(await screen.findByText("No follow-up recorded.")).toBeInTheDocument();
    expect(screen.getByText("No follow-up currently scheduled.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Follow-up date/ }), { target: { value: "05102026" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Site observations/ }), { target: { value: "Coral condition unchanged." } });
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    await waitFor(() => expect(api.createMonitoring).toHaveBeenCalledWith("RC-1", {
      actionDate: "2026-10-05", conditionCode: "stable", observations: "Coral condition unchanged.",
      notes: undefined, nextFollowUpRequired: false,
    }));
    expect(await screen.findByText("The monitoring visit was recorded.")).toBeInTheDocument();
  });

  it("does not offer follow-up entry before assessment", async () => {
    render(<FollowUpPanel reportReference="RC-1" statusCode="under_review" />);
    expect(await screen.findByText("No follow-up recorded.")).toBeInTheDocument();
    expect(screen.getByText("Follow-up can be recorded after the evidence assessment.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save follow-up" })).not.toBeInTheDocument();
  });
});

const taken: FollowUp = {
  caseActionId: 8, caseEventId: 88, reportReference: "RC-1", followUpType: "action", followUpState: "action_taken",
  recordingLevel: "coordinator_summary", actionTypeCode: "reef_cleanup", actionTypeLabel: "Reef clean-up",
  actionDate: "2026-10-05", responsibleTeam: "Private team", sourceReference: "Private source",
  observations: null, recordedOutcome: "Net removed from the reef.", notes: "Confidential checklist",
  conditionCode: null, conditionLabel: null, conditionReviewedByName: null, nextFollowUpRequired: null, nextFollowUpDate: null,
  isPublishable: false, isDemonstration: false, supersedesCaseActionId: null, supersededByCaseActionId: null,
  statusCode: "response_complete", createdBy: 7, createdByName: "Coordinator", createdAt: "2026-10-05T10:00:00Z", evidence: [],
};

function list(...items: FollowUp[]) {
  return { reportReference: "RC-1", items, total: items.length, message: "Follow-up history." };
}

async function openPublication() {
  fireEvent.click(await screen.findByRole("button", { name: "Publish to public activity" }));
}

describe("follow-up publication", () => {
  it("requires confirmation and uses the returned version ID for withdrawal", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValue(list(taken));
    vi.mocked(api.setFollowUpPublication).mockResolvedValueOnce({ ...taken, caseActionId: 12, caseEventId: 120,
      supersedesCaseActionId: 8, isPublishable: true }).mockResolvedValueOnce({ ...taken, caseActionId: 13, caseEventId: 130,
      supersedesCaseActionId: 12, isPublishable: false });
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    await openPublication();
    expect(api.setFollowUpPublication).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("heading", { name: "Publish this follow-up?" }).closest("section");
    expect(confirmation).toHaveTextContent("Net removed from the reef.");
    expect(confirmation).not.toHaveTextContent("Private team");
    expect(confirmation).not.toHaveTextContent("Private source");
    expect(confirmation).not.toHaveTextContent("Confidential checklist");
    fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
    expect(await screen.findByText("This follow-up is published in public site activity.")).toBeInTheDocument();
    expect(api.setFollowUpPublication).toHaveBeenCalledWith("RC-1", 8, true);
    expect(screen.getAllByText("Recorded outcome:")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw from public activity" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    expect(await screen.findByText(/was withdrawn from public site activity/)).toBeInTheDocument();
    expect(api.setFollowUpPublication).toHaveBeenLastCalledWith("RC-1", 12, false);
    expect(screen.getByRole("button", { name: "Publish to public activity" })).toBeInTheDocument();
    expect(api.createFollowUp).not.toHaveBeenCalled();
    expect(api.correctFollowUp).not.toHaveBeenCalled();
  });

  it.each([
    ["planned", { followUpState: "action_planned" }],
    ["monitoring", { followUpType: "monitoring", followUpState: "monitoring_recorded" }],
    ["missing outcome", { recordedOutcome: "  " }],
    ["demonstration", { isDemonstration: true }],
    ["superseded", { supersededByCaseActionId: 9 }],
    ["unknown publication status", { isPublishable: undefined }],
    ["unknown demonstration status", { isDemonstration: undefined }],
  ])("does not publish a %s record", async (_label, changes) => {
    vi.mocked(api.getFollowUps).mockResolvedValue(list({ ...taken, ...changes } as FollowUp));
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    await screen.findByRole("heading", { name: "Recorded history" });
    expect(screen.queryByRole("button", { name: "Publish to public activity" })).not.toBeInTheDocument();
    expect(api.setFollowUpPublication).not.toHaveBeenCalled();
  });

  it("allows a recorded external outcome to be published", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValue(list({ ...taken, followUpType: "sourced_outcome", followUpState: "outcome_recorded", recordingLevel: "externally_sourced" }));
    render(<FollowUpPanel reportReference="RC-1" statusCode="referred" />);
    await openPublication();
    expect(screen.getByText(/externally reported, not a verified ReefCare action/)).toBeInTheDocument();
  });

  it("prevents duplicate requests while publishing", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValue(list(taken));
    let resolve!: (record: FollowUp & { isPublishable: boolean }) => void;
    vi.mocked(api.setFollowUpPublication).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    await openPublication();
    const confirm = screen.getByRole("button", { name: "Confirm publication" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(api.setFollowUpPublication).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    resolve({ ...taken, caseActionId: 12, isPublishable: true });
    await screen.findByText("This follow-up is published in public site activity.");
  });

  it("keeps a rejected ownership request private", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValue(list(taken));
    vi.mocked(api.setFollowUpPublication).mockRejectedValueOnce(new ApiError("Not owner", 403));
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    await openPublication();
    fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("do not have permission");
    expect(screen.getByText("Private — not published")).toBeInTheDocument();
    expect(screen.queryByText("This follow-up is published in public site activity.")).not.toBeInTheDocument();
  });

  it("refreshes a superseded record after a conflict instead of reusing its old ID", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValueOnce(list(taken)).mockResolvedValueOnce(list({ ...taken, caseActionId: 15 }));
    vi.mocked(api.setFollowUpPublication).mockRejectedValueOnce(new ApiError("Superseded", 409))
      .mockResolvedValueOnce({ ...taken, caseActionId: 16, isPublishable: true });
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    await openPublication();
    fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("history has been refreshed");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm publication" })).not.toBeInTheDocument());
    await openPublication();
    fireEvent.click(screen.getByRole("button", { name: "Confirm publication" }));
    await screen.findByText("This follow-up is published in public site activity.");
    expect(api.setFollowUpPublication).toHaveBeenLastCalledWith("RC-1", 15, true);
  });

  it("shows a corrected published follow-up as private and does not republish it automatically", async () => {
    vi.mocked(api.getFollowUps).mockResolvedValueOnce(list({ ...taken, isPublishable: true }))
      .mockResolvedValueOnce(list({ ...taken, caseActionId: 15, supersedesCaseActionId: 8, recordedOutcome: "Updated outcome." }));
    vi.mocked(api.correctFollowUp).mockResolvedValueOnce({ ...taken, caseActionId: 15 });
    render(<FollowUpPanel reportReference="RC-1" statusCode="response_complete" />);
    fireEvent.click(await screen.findByRole("button", { name: "Correct this record" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Recorded outcome$/ }), { target: { value: "Updated outcome." } });
    fireEvent.change(screen.getByRole("textbox", { name: /Reason for correction/ }), { target: { value: "Corrected description" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(await screen.findByText(/corrected version is private until published again/)).toBeInTheDocument();
    expect(screen.getByText("Private — not published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish to public activity" })).toBeInTheDocument();
    expect(api.setFollowUpPublication).not.toHaveBeenCalled();
    expect(api.correctFollowUp).toHaveBeenCalledWith("RC-1", 8, { recordedOutcome: "Updated outcome.", correctionReason: "Corrected description" });
  });

  it("attaches follow-up evidence by caseEventId", async () => {
    vi.mocked(api.createMonitoring).mockResolvedValueOnce({ ...taken, caseActionId: 8, caseEventId: 88 });
    vi.mocked(coordinatorApi.uploadConservationActionEvidence).mockResolvedValueOnce({ evidenceId: 19, mediaType: "photo", uploadedAt: "2026-10-05T10:00:00Z" });
    render(<FollowUpPanel reportReference="RC-1" statusCode="evidence_accepted" />);
    await screen.findByText("No follow-up recorded.");
    fireEvent.change(screen.getByRole("textbox", { name: /Follow-up date/ }), { target: { value: "05102026" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Site observations/ }), { target: { value: "Condition unchanged." } });
    const file = new File(["photo"], "reef.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Supporting photo/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
    await waitFor(() => expect(coordinatorApi.uploadConservationActionEvidence).toHaveBeenCalledWith("RC-1", 88, file));
  });
});

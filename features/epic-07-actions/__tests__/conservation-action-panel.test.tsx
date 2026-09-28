import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConservationAction,
  getConservationActions,
  getConservationActionTypes,
  getCoordinatorEvidence,
  uploadConservationActionEvidence,
} from "@/lib/api/coordinatorApi";
import { ConservationActionPanel } from "../conservation-action-panel";

vi.mock("@/lib/api/coordinatorApi");

const mockedGetActionTypes = vi.mocked(getConservationActionTypes);
const mockedGetActions = vi.mocked(getConservationActions);
const mockedCreateAction = vi.mocked(createConservationAction);
const mockedGetCoordinatorEvidence = vi.mocked(getCoordinatorEvidence);
const mockedUploadActionEvidence = vi.mocked(uploadConservationActionEvidence);

beforeEach(() => {
  mockedGetActionTypes.mockReset();
  mockedGetActions.mockReset();
  mockedCreateAction.mockReset();
  mockedGetCoordinatorEvidence.mockReset();
  mockedUploadActionEvidence.mockReset();

  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:action-evidence") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  mockedGetCoordinatorEvidence.mockResolvedValue(new Blob(["image"], { type: "image/jpeg" }));

  mockedGetActionTypes.mockResolvedValue([
    { code: "reef_cleanup", label: "Reef clean-up", description: "Remove debris through an authorised response." },
  ]);
  mockedGetActions.mockResolvedValue({
    reportReference: "RC-0710",
    total: 1,
    items: [{
      caseActionId: 4,
      reportReference: "RC-0710",
      actionTypeCode: "reef_cleanup",
      actionTypeLabel: "Reef clean-up",
      actionState: "action_planned",
      actionDate: "2026-09-20",
      responsibleTeam: "Tioman response team",
      notes: "Awaiting safe sea conditions.",
      statusCode: "response_planned",
      createdBy: 8,
      createdByName: "Farid",
      createdAt: "2026-09-13T08:30:00Z",
    }],
  });
});

describe("Epic 7 conservation action record", () => {
  it("loads action history and distinguishes a plan from completed work", async () => {
    render(<ConservationActionPanel reportReference="RC-0710" />);

    expect(screen.queryByText(/Epic 7/i)).not.toBeInTheDocument();
    expect(screen.getByText("Conservation action")).toBeInTheDocument();
    expect(await screen.findByText("Action planned — not completed")).toBeInTheDocument();
    expect(screen.getByText("This is a plan only. It does not confirm that conservation work has happened.")).toBeInTheDocument();
    expect(screen.getByText("Tioman response team")).toBeInTheDocument();
    expect(screen.getByText("Farid")).toBeInTheDocument();
  });

  it("uses the recorder returned by the backend instead of the current case owner", async () => {
    mockedGetActions.mockResolvedValueOnce({
      reportReference: "RC-0710",
      total: 1,
      items: [{
        caseActionId: 8,
        reportReference: "RC-0710",
        actionTypeCode: "reef_cleanup",
        actionTypeLabel: "Reef clean-up",
        actionState: "action_taken",
        actionDate: "2026-09-17",
        responsibleTeam: "Team 18",
        notes: null,
        statusCode: "response_complete",
        createdBy: 8,
        createdByName: "Original Coordinator",
        createdAt: "2026-09-17T14:15:00Z",
      }],
    });

    render(<ConservationActionPanel reportReference="RC-0710" />);

    expect(await screen.findByText("Original Coordinator")).toBeInTheDocument();
    expect(screen.queryByText("Authorised coordinator")).not.toBeInTheDocument();
  });

  it("requires a date before recording an action as taken", async () => {
    const user = userEvent.setup();
    render(<ConservationActionPanel reportReference="RC-0710" />);

    await screen.findByRole("heading", { name: "Record an action update" });
    await user.click(screen.getByLabelText(/Action taken/));
    await user.type(screen.getByLabelText("Responsible team *"), "Tioman response team");
    await user.click(screen.getByRole("button", { name: "Record action update" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the date the action was taken.");
    expect(mockedCreateAction).not.toHaveBeenCalled();
  });

  it("records a planned action using the confirmed API fields", async () => {
    const user = userEvent.setup();
    mockedCreateAction.mockResolvedValue({
      caseActionId: 5,
      reportReference: "RC-0710",
      actionTypeCode: "reef_cleanup",
      actionTypeLabel: "Reef clean-up",
      actionState: "action_planned",
      actionDate: "2026-09-20",
      responsibleTeam: "Marine Park response team",
      notes: "Equipment and weather check required.",
      statusCode: "response_planned",
      createdBy: 8,
      createdByName: "Farid",
      createdAt: "2026-09-13T09:30:00Z",
    });

    render(<ConservationActionPanel reportReference="RC-0710" />);
    await screen.findByRole("heading", { name: "Record an action update" });

    await user.type(screen.getByLabelText("Planned action date, format dd/mm/yyyy"), "20092026");
    await user.type(screen.getByLabelText("Responsible team *"), "Marine Park response team");
    await user.type(screen.getByLabelText(/^Action notes/), "Equipment and weather check required.");
    await user.click(screen.getByRole("button", { name: "Record action update" }));

    await waitFor(() => expect(mockedCreateAction).toHaveBeenCalledWith("RC-0710", {
      actionTypeCode: "reef_cleanup",
      actionState: "action_planned",
      actionDate: "2026-09-20",
      responsibleTeam: "Marine Park response team",
      notes: "Equipment and weather check required.",
    }));
    expect(await screen.findByText("The planned conservation action was recorded without marking it as completed.")).toBeInTheDocument();
  });

  it("attaches a supported evidence image to the newly recorded action", async () => {
    const user = userEvent.setup();
    mockedCreateAction.mockResolvedValue({
      caseActionId: 6,
      reportReference: "RC-0710",
      actionTypeCode: "reef_cleanup",
      actionTypeLabel: "Reef clean-up",
      actionState: "action_planned",
      actionDate: null,
      responsibleTeam: "Marine Park response team",
      notes: null,
      statusCode: "response_planned",
      createdBy: 8,
      createdByName: "Farid",
      createdAt: "2026-09-13T09:30:00Z",
      evidence: [],
    });
    mockedUploadActionEvidence.mockResolvedValue({
      evidenceId: 19,
      mediaType: "image/jpeg",
      fileSizeBytes: 13,
      uploadedAt: "2026-09-13T09:31:00Z",
      caseActionId: 6,
    });
    const file = new File(["reef evidence"], "completed-action.jpg", { type: "image/jpeg" });

    render(<ConservationActionPanel reportReference="RC-0710" />);
    await screen.findByRole("heading", { name: "Record an action update" });
    await user.type(screen.getByLabelText("Responsible team *"), "Marine Park response team");
    await user.upload(screen.getByLabelText("Choose action evidence image"), file);
    await user.click(screen.getByRole("button", { name: "Record action update" }));

    await waitFor(() => expect(mockedUploadActionEvidence).toHaveBeenCalledWith("RC-0710", 6, file));
    expect(await screen.findByText(/The evidence image was attached/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My Cases" })).toHaveAttribute("href", "/coordinator/my-cases");
    expect(await screen.findByRole("img", { name: "Action evidence 1 for Reef clean-up" })).toHaveAttribute("src", "blob:action-evidence");
    expect(mockedGetCoordinatorEvidence).toHaveBeenCalledWith("RC-0710", 19);
  });
});

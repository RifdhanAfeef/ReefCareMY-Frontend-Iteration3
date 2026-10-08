import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowUpPanel } from "../follow-up-panel";
import * as api from "@/lib/api/iteration3Api";
import * as coordinatorApi from "@/lib/api/coordinatorApi";

vi.mock("@/lib/api/iteration3Api");
vi.mock("@/lib/api/coordinatorApi");

beforeEach(() => {
  vi.clearAllMocks();
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

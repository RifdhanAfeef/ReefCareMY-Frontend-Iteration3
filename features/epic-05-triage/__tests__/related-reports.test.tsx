import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { RelatedReportsPanel } from "../related-reports";
import * as api from "@/lib/api/iteration3Api";

vi.mock("@/lib/api/iteration3Api");
vi.mock("@/lib/api/coordinatorApi");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getRelatedReports).mockResolvedValue({
    reportReference: "RC-1", analysisState: "matches_available", message: "One potential match.",
    ruleVersion: "v1", analysedAt: "2026-10-05T10:00:00Z",
    candidates: [{
      candidateReportReference: "RC-2", relatednessLevel: "medium",
      signals: [{ code: "same_site", label: "Same dive site", detail: null }],
      ownershipState: "owned_by_you", decisionState: "undecided", reopenedByNewEvidence: false,
    }],
  });
  vi.mocked(api.compareReports).mockResolvedValue({
    current: { reportReference: "RC-1", statusCode: "under_review", statusLabel: "Under review", threatCategoryCode: "ghost_gear", threatCategoryLabel: "Ghost fishing gear", observedAt: null, submittedAt: "2026-10-05T10:00:00Z", diveSiteName: "Tiger Reef", publicAreaLabel: "Tioman", locationConfidenceCode: null, estimatedDepthMetres: null, description: "Net", incidentReference: null, evidence: [] },
    candidate: { reportReference: "RC-2", statusCode: "under_review", statusLabel: "Under review", threatCategoryCode: "ghost_gear", threatCategoryLabel: "Ghost fishing gear", observedAt: null, submittedAt: "2026-10-05T11:00:00Z", diveSiteName: "Tiger Reef", publicAreaLabel: "Tioman", locationConfidenceCode: null, estimatedDepthMetres: null, description: "Net near coral", incidentReference: null, evidence: [] },
    signals: [{ code: "same_site", label: "Same dive site", detail: null }],
    relatednessLevel: "medium", latestDecision: null,
  });
  vi.mocked(api.decideRelationship).mockResolvedValue({
    incidentReference: "INC-0010", rejectionReasonCode: null, decidedBy: 7, decidedAt: "2026-10-05T12:00:00Z",
  });
});

describe("related-report review", () => {
  it("requires a human confirmation and preserves the separate case reviews", async () => {
    render(<RelatedReportsPanel reportReference="RC-1" />);
    expect(await screen.findByText("RC-2")).toBeInTheDocument();
    expect(screen.getByText(/only your decision links them/i)).toBeInTheDocument();
    expect(screen.getByText("Your case")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare reports" }));
    expect(await screen.findByRole("heading", { name: "Compare reports" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm same incident" }));
    expect(screen.getByText(/Each report keeps its own history and evidence/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
    expect(await screen.findByText(/linked under INC-0010/)).toBeInTheDocument();
    expect(api.decideRelationship).toHaveBeenCalledWith("RC-1", "RC-2", { decision: "same_incident" });
  });

  it("claims an unclaimed candidate before showing the private comparison", async () => {
    vi.mocked(api.getRelatedReports).mockResolvedValueOnce({
      reportReference: "RC-1", analysisState: "matches_available", message: "One potential match.",
      ruleVersion: "v1", analysedAt: "2026-10-05T10:00:00Z",
      candidates: [{ candidateReportReference: "RC-3", relatednessLevel: "high",
        signals: [{ code: "same_site", label: "Same dive site", detail: "Both at Tiger Reef" }],
        ownershipState: "unclaimed", decisionState: "undecided", reopenedByNewEvidence: false }],
    });
    vi.mocked(api.claimAndCompare).mockResolvedValueOnce(await api.compareReports("RC-1", "RC-2"));
    render(<RelatedReportsPanel reportReference="RC-1" />);
    expect(await screen.findByText("RC-3")).toBeInTheDocument();
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Similarity signals" })).toHaveTextContent("Same dive site");
    fireEvent.click(screen.getByRole("button", { name: "Claim and compare" }));
    expect(api.claimAndCompare).toHaveBeenCalledWith("RC-1", "RC-3");
    expect(await screen.findByRole("heading", { name: "Compare reports" })).toBeInTheDocument();
  });

  it("blocks combining two established incident groups but still allows Not Related", async () => {
    const comparison = await api.compareReports("RC-1", "RC-2");
    vi.mocked(api.compareReports).mockResolvedValueOnce({ ...comparison,
      current: { ...comparison.current, incidentReference: "INC-1" },
      candidate: { ...comparison.candidate, incidentReference: "INC-2" },
    });
    render(<RelatedReportsPanel reportReference="RC-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare reports" }));
    expect(await screen.findByRole("button", { name: "Confirm same incident" })).toBeDisabled();
    expect(screen.getByText(/already belong to different incident groups/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not related" })).toBeEnabled();
    expect(api.decideRelationship).not.toHaveBeenCalled();
  });

  it("allows confirmation when reports already share the same incident", async () => {
    const comparison = await api.compareReports("RC-1", "RC-2");
    vi.mocked(api.compareReports).mockResolvedValueOnce({ ...comparison,
      current: { ...comparison.current, incidentReference: "INC-1" },
      candidate: { ...comparison.candidate, incidentReference: "INC-1" },
    });
    render(<RelatedReportsPanel reportReference="RC-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare reports" }));
    expect(await screen.findByRole("button", { name: "Confirm same incident" })).toBeEnabled();
  });

  it("keeps the linking conflict visible after refreshing and re-checks current incident membership", async () => {
    const comparison = await api.compareReports("RC-1", "RC-2");
    vi.mocked(api.compareReports).mockResolvedValueOnce(comparison).mockResolvedValueOnce({ ...comparison,
      current: { ...comparison.current, incidentReference: "INC-1" },
      candidate: { ...comparison.candidate, incidentReference: "INC-2" },
    });
    vi.mocked(api.decideRelationship).mockRejectedValueOnce(new ApiError("Workflow conflict", 409));
    render(<RelatedReportsPanel reportReference="RC-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm same incident" }));
    fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already belong to different incident groups");
    expect(api.getRelatedReports).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Confirm same incident" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save decision" })).not.toBeInTheDocument();
    expect(screen.queryByText(/linked under INC/)).not.toBeInTheDocument();
  });

  it("does not describe an unrelated workflow conflict as an incident-group merge", async () => {
    vi.mocked(api.decideRelationship).mockRejectedValueOnce(new ApiError("Workflow conflict", 409));
    render(<RelatedReportsPanel reportReference="RC-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm same incident" }));
    fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reports changed");
    expect(screen.queryByText(/already belong to different incident groups/)).not.toBeInTheDocument();
  });

  it("distinguishes analysis failure from no matches", async () => {
    vi.mocked(api.getRelatedReports).mockResolvedValueOnce({
      reportReference: "RC-1", analysisState: "unavailable", message: "Analysis unavailable. Review can continue.",
      ruleVersion: null, analysedAt: null, candidates: [],
    });
    render(<RelatedReportsPanel reportReference="RC-1" />);
    expect(await screen.findByText("Analysis unavailable. Review can continue.")).toBeInTheDocument();
    expect(screen.queryByText(/No related reports are available to you/)).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../client";
import {
  claimAndCompare, createFollowUp, createMonitoring, decideRelationship,
  uploadFollowUpEvidence, setFollowUpPublication, getExternalContext, getFollowUps, getPublicSiteContext, getRelatedReports, getSiteHistory,
} from "../iteration3Api";

vi.mock("../client", () => ({ apiRequest: vi.fn() }));
beforeEach(() => vi.mocked(apiRequest).mockReset());

describe("Iteration 3 API boundaries", () => {
  it("claims a candidate before comparison and sends an explicit human decision", async () => {
    await claimAndCompare("RC/1", "RC/2");
    await decideRelationship("RC/1", "RC/2", { decision: "not_related", rejectionReasonCode: "different_location" });
    expect(apiRequest).toHaveBeenNthCalledWith(1, {
      path: "/api/v1/coordinator/reports/RC%2F1/related-reports/RC%2F2/claim-and-compare",
      method: "POST",
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, {
      path: "/api/v1/coordinator/reports/RC%2F1/related-reports/RC%2F2/decision",
      method: "POST", body: { decision: "not_related", rejectionReasonCode: "different_location" },
    });
    await getRelatedReports("RC/1");
    expect(apiRequest).toHaveBeenLastCalledWith({ path: "/api/v1/coordinator/reports/RC%2F1/related-reports", signal: undefined });
  });

  it("keeps action, sourced outcome and monitoring on the documented routes", async () => {
    await createFollowUp("RC-1", {
      followUpType: "sourced_outcome", followUpState: "outcome_recorded", recordingLevel: "externally_sourced",
      actionDate: "2026-10-05", sourceReference: "Partner update", recordedOutcome: "Survey completed",
    });
    await createMonitoring("RC-1", {
      actionDate: "2026-10-05", conditionCode: "stable", observations: "Condition unchanged",
      nextFollowUpRequired: false,
    });
    await getFollowUps("RC-1", true);
    expect(apiRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: "/api/v1/coordinator/reports/RC-1/follow-ups", method: "POST" }));
    expect(apiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: "/api/v1/coordinator/reports/RC-1/monitoring", method: "POST" }));
    expect(apiRequest).toHaveBeenNthCalledWith(3, { path: "/api/v1/coordinator/reports/RC-1/follow-ups?includeSuperseded=true" });
  });

  it("separates protected site history from public-safe and NOAA context", async () => {
    await getSiteHistory(12);
    await getPublicSiteContext(12);
    await getExternalContext(12);
    expect(apiRequest).toHaveBeenNthCalledWith(1, { path: "/api/v1/coordinator/sites/12/history" });
    expect(apiRequest).toHaveBeenNthCalledWith(2, { path: "/api/v1/public/dive-sites/12/context", auth: false, signal: undefined });
    expect(apiRequest).toHaveBeenNthCalledWith(3, { path: "/api/v1/public/dive-sites/12/external-context", auth: false, signal: undefined, timeoutMs: 30_000 });
  });
});

it("publishes and withdraws through the owner-scoped publication route", async () => {
  await setFollowUpPublication("RC/1", 8, true);
  await setFollowUpPublication("RC/1", 12, false);
  expect(apiRequest).toHaveBeenNthCalledWith(1, { path: "/api/v1/coordinator/reports/RC%2F1/follow-ups/8/publication", method: "POST", body: { publish: true } });
  expect(apiRequest).toHaveBeenNthCalledWith(2, { path: "/api/v1/coordinator/reports/RC%2F1/follow-ups/12/publication", method: "POST", body: { publish: false } });
});


it("uploads follow-up evidence to the caseActionId route using the file multipart field", async () => {
  const file = new File(["photo"], "reef.jpg", { type: "image/jpeg" });
  await uploadFollowUpEvidence("RC/1", 8, file);
  const request = vi.mocked(apiRequest).mock.calls[0][0];
  expect(request.path).toBe("/api/v1/coordinator/reports/RC%2F1/follow-ups/8/evidence");
  expect(request.method).toBe("POST");
  expect(request.timeoutMs).toBe(60_000);
  expect(request.body).toBeInstanceOf(FormData);
  expect((request.body as FormData).get("file")).toBe(file);
  expect(Array.from((request.body as FormData).keys())).toEqual(["file"]);
});

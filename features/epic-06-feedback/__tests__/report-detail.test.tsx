import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReportDetail } from "../report-detail";
import * as reportsApi from "@/lib/api/reportsApi";
import type { ReportDetail as ReportDetailData } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/reportsApi");
const mockedGetReportDetail = vi.mocked(reportsApi.getReportDetail);
const mockedGetOpenInformationRequest = vi.mocked(reportsApi.getOpenInformationRequest);
const mockedSubmitInformationResponse = vi.mocked(reportsApi.submitInformationResponseWithPhotos);

beforeEach(() => {
  window.localStorage.clear();
  let previewNumber = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => `blob:reply-photo-${++previewNumber}`) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  mockedGetReportDetail.mockReset();
  mockedGetOpenInformationRequest.mockReset();
  mockedGetOpenInformationRequest.mockResolvedValue(null);
  mockedSubmitInformationResponse.mockReset();
});

function baseReport(overrides: Partial<ReportDetailData> = {}): ReportDetailData {
  return {
    reportReference: "RC-0241",
    threatCategory: "Ghost fishing gear",
    description: "Large fishing net tangled around coral",
    observedAt: "2026-08-24T12:30:00Z",
    estimatedDepthMetres: 12.5,
    generalLocation: "Tiger Reef, Tioman Island",
    diveSite: "Tiger Reef",
    preciseLocation: null,
    status: "under_review",
    statusLabel: "Being reviewed",
    outcome: null,
    informationRequestReason: null,
    closure: null,
    submittedAt: "2026-08-25T04:40:00Z",
    ...overrides,
  };
}

describe("Report detail — shows what was observed", () => {
  it("renders threat type, description and location", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport());

    render(<ReportDetail reportReference="RC-0241" />);

    expect(await screen.findByText("Ghost fishing gear")).toBeInTheDocument();
    expect(screen.getByText("Large fishing net tangled around coral")).toBeInTheDocument();
    expect(screen.getByText("Tiger Reef")).toBeInTheDocument();
  });

  it("lets the Observer expand the submitted structured fields", async () => {
    window.localStorage.setItem(
      "reefcare:submitted-structured-details:RC-0241",
      JSON.stringify({
        approximate_size: "About 3 metres",
        animal_interaction: "No animal interaction",
        site_reference: "North of Tiger Reef",
      }),
    );
    mockedGetReportDetail.mockResolvedValue(baseReport());

    render(<ReportDetail reportReference="RC-0241" />);

    const summary = await screen.findByText("Structured report details");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary);

    expect(details).toHaveAttribute("open");
    expect(within(details!).getByText("12.5 m")).toBeInTheDocument();
    expect(within(details!).getByText("About 3 metres")).toBeInTheDocument();
    expect(within(details!).getByText("No animal interaction")).toBeInTheDocument();
    expect(within(details!).getByText("North of Tiger Reef")).toBeInTheDocument();
    expect(within(details!).getByText("Not included")).toBeInTheDocument();
  });

  it("shows optional surface context separately from the exact underwater location", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport({
      preciseLocation: {
        latitude: null,
        longitude: null,
        uncertaintyMetres: null,
        confidenceLabel: "Dive-site only",
        sourceLabel: "Named dive site",
        relocationNotes: "Surface entry context: Entered from the northern boat mooring\nSurface exit context: Surfaced beside the jetty",
      },
    }));

    render(<ReportDetail reportReference="RC-0241" />);

    expect(await screen.findByText("Surface entry and exit context")).toBeInTheDocument();
    expect(screen.getByText(/Entered from the northern boat mooring/)).toBeInTheDocument();
    expect(screen.getByText(/not the exact underwater threat location/i)).toBeInTheDocument();
    expect(screen.queryByText("Submitted location")).not.toBeInTheDocument();
  });

  it("does not display technical failure details", async () => {
    mockedGetReportDetail.mockRejectedValue(new ApiError("Database query failed", 500));

    render(<ReportDetail reportReference="RC-0241" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ReefCare MY is temporarily unavailable. Please try again shortly.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/database|backend|API|500/i);
  });
});

describe("US6.3 — information request reason is visible", () => {
  it("shows the reason when the backend sends one", async () => {
    mockedGetReportDetail.mockResolvedValue(
      baseReport({
        status: "needs_more_info",
        statusLabel: "More information needed",
        informationRequestReason: "Please confirm the approximate size of the net.",
      }),
    );

    render(<ReportDetail reportReference="RC-0241" />);

    expect(
      await screen.findByText(/Please confirm the approximate size of the net\./),
    ).toBeInTheDocument();
  });

  it("submits an observer response on the same report", async () => {
    mockedGetReportDetail.mockResolvedValue(
      baseReport({
        status: "needs_more_info",
        statusLabel: "More information needed",
        informationRequestReason: "Please confirm the approximate size of the net.",
      }),
    );
    mockedGetOpenInformationRequest.mockResolvedValue({
      requestText: "Please confirm the approximate size of the net.",
      requestedAt: "2026-09-10T04:00:00Z",
    });
    mockedSubmitInformationResponse.mockResolvedValue({
      reportReference: "RC-0241",
      status: "under_review",
      responseText: "The net was approximately 3 metres wide.",
      respondedAt: "2026-09-11T04:00:00Z",
      caseEventId: 881,
      evidence: [],
    });

    render(<ReportDetail reportReference="RC-0241" />);
    const response = await screen.findByLabelText(/Additional details/);
    fireEvent.change(response, { target: { value: "The net was approximately 3 metres wide." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));

    await waitFor(() => expect(mockedSubmitInformationResponse).toHaveBeenCalledWith(
      "RC-0241",
      { responseText: "The net was approximately 3 metres wide." },
      [],
    ));
    expect(await screen.findByText(/attached to this report/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Additional details/)).not.toBeInTheDocument();
  });

  it("offers optional photos with the documented limits", async () => {
    mockedGetReportDetail.mockResolvedValue(
      baseReport({
        status: "needs_more_info",
        statusLabel: "More information needed",
        informationRequestReason: "Please add a clearer photograph.",
      }),
    );
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByLabelText("Additional photos (optional)")).toHaveAttribute("multiple");
    expect(screen.getByText(/Up to 5 JPG, PNG or WebP photos/)).toBeInTheDocument();
    expect(screen.queryByText(/Photograph uploads are temporarily unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Additional details/)).toHaveAttribute("maxlength", "2000");
  });

  it("requires written details", async () => {
    mockedGetReportDetail.mockResolvedValue(
      baseReport({
        status: "needs_more_info",
        statusLabel: "More information needed",
        informationRequestReason: "Please clarify the observation.",
      }),
    );

    render(<ReportDetail reportReference="RC-0241" />);
    fireEvent.click(await screen.findByRole("button", { name: "Submit additional information" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Add the requested details/i);
    expect(mockedSubmitInformationResponse).not.toHaveBeenCalled();
  });

  it("shows nothing extra when there is no information request", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport());

    render(<ReportDetail reportReference="RC-0241" />);

    await screen.findByText("Ghost fishing gear");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("US6.2 AC3 — closure reason is visible", () => {
  it("shows the closure label and public note for a closed report", async () => {
    mockedGetReportDetail.mockResolvedValue(
      baseReport({
        status: "closed_no_partner",
        statusLabel: "Closed",
        closure: {
          status: "closed_no_partner",
          closureLabel: "Recorded, no active response programme currently covers this site",
          publicNote: "We'll revisit if a partner becomes available.",
        },
      }),
    );

    render(<ReportDetail reportReference="RC-0241" />);

    expect(
      await screen.findByText(
        /Recorded, no active response programme currently covers this site/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We'll revisit if a partner becomes available\./),
    ).toBeInTheDocument();
  });
});


describe("Observer contribution feedback", () => {
  it.each(["planned", "action_planned"])("keeps an unpublished %s action clearly planned", async (state) => {
    // E6 does not require or receive an E8 publication flag.
    mockedGetReportDetail.mockResolvedValue(baseReport({
      contribution: {
        contributionType: "action", state,
        label: "Your report informed a planned action",
        detail: "A follow-up action has been planned.",
        recordedAt: "2026-10-09T08:00:00Z",
        nextFollowUpRequired: false, nextFollowUpDate: null,
      },
    }));
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByText("Your report informed a planned action")).toBeInTheDocument();
    expect(screen.getByText("This work is planned. It has not been recorded as completed.")).toBeInTheDocument();
    expect(reportsApi.getReportDetail).toHaveBeenCalledWith("RC-0241");
  });

  it("distinguishes a sourced external outcome from work completed by ReefCare", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport({
      contribution: {
        contributionType: "sourced_outcome", state: "outcome_recorded",
        label: "An external outcome was recorded",
        detail: "A follow-up outcome was reported by an external organisation.",
        recordedAt: "2026-10-09T08:00:00Z",
        nextFollowUpRequired: false, nextFollowUpDate: null,
      },
    }));
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByText("An external outcome was recorded")).toBeInTheDocument();
    expect(screen.getByText(/This outcome was reported by an external source/)).toHaveTextContent("It is not a record of work completed by ReefCare MY.");
  });

  it("renders only the current safe projection and ignores unexpected private fields", async () => {
    const contribution = {
      contributionType: "action", state: "action_taken",
      label: "Your report informed a recorded action",
      detail: "The current recorded outcome is available.",
      recordedAt: "2026-10-09T08:00:00Z",
      nextFollowUpRequired: false, nextFollowUpDate: null,
      isPublishable: false,
      notes: "PRIVATE INTERNAL NOTE", responsibleTeam: "PRIVATE PERSON",
      sourceReference: "PRIVATE SOURCE REFERENCE", reportReference: "OTHER-PRIVATE-REPORT",
      supersededRecord: { detail: "OLD SUPERSEDED OUTCOME" },
      demonstrationRecord: { detail: "DEMONSTRATION OUTCOME" },
    };
    mockedGetReportDetail.mockResolvedValue(baseReport({ contribution }));
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByText("The current recorded outcome is available.")).toBeInTheDocument();
    for (const value of ["PRIVATE INTERNAL NOTE", "PRIVATE PERSON", "PRIVATE SOURCE REFERENCE", "OTHER-PRIVATE-REPORT", "OLD SUPERSEDED OUTCOME", "DEMONSTRATION OUTCOME"]) {
      expect(screen.queryByText(value)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/This work is planned/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This outcome was reported by an external source/)).not.toBeInTheDocument();
  });

  it("shows the backend's safe referral explanation without claiming completed action", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport({
      contribution: {
        contributionType: "referral", state: "referred",
        label: "Your report informed a referral",
        detail: "A referral was recorded. This does not mean an action has been completed.",
        recordedAt: "2026-10-05T10:00:00Z",
        nextFollowUpRequired: false, nextFollowUpDate: null,
      },
    }));
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByRole("heading", { name: "Your contribution" })).toBeInTheDocument();
    expect(screen.getByText("Your report informed a referral")).toBeInTheDocument();
    expect(screen.getByText(/A referral was recorded/)).toHaveTextContent("This does not mean an action has been completed.");
    expect(screen.queryByText(/Next follow-up/)).not.toBeInTheDocument();
  });

  it("shows a required next follow-up date from recorded monitoring", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport({
      contribution: {
        contributionType: "monitoring", state: "recorded",
        label: "Your report informed monitoring", detail: null, recordedAt: null,
        nextFollowUpRequired: true, nextFollowUpDate: "2026-10-12",
      },
    }));
    render(<ReportDetail reportReference="RC-0241" />);
    expect(await screen.findByText(/Next follow-up/)).toHaveTextContent("12");
    expect(screen.getByText(/Next follow-up/).querySelector("time")).toHaveAttribute("dateTime", "2026-10-12");
  });

  it("does not invent contribution feedback when none is returned", async () => {
    mockedGetReportDetail.mockResolvedValue(baseReport({ contribution: null }));
    render(<ReportDetail reportReference="RC-0241" />);
    await screen.findByText("Ghost fishing gear");
    expect(screen.queryByRole("heading", { name: "Your contribution" })).not.toBeInTheDocument();
  });
});


async function openPhotoReply() {
  mockedGetReportDetail.mockResolvedValue(baseReport({ status: "needs_more_info", statusLabel: "More information needed", informationRequestReason: "Please add a wider photo." }));
  render(<ReportDetail reportReference="RC-0241" />);
  const input = await screen.findByLabelText("Additional photos (optional)");
  fireEvent.change(screen.getByLabelText("Additional details"), { target: { value: "Wider view attached." } });
  return input;
}

const acceptedPhotoReply = {
  reportReference: "RC-0241", status: "under_review" as const,
  responseText: "Wider view attached.", respondedAt: "2026-10-10T03:00:00Z", caseEventId: 881,
  evidence: [{ evidenceId: 501, mediaType: "photo", fileSizeBytes: 5, uploadedAt: "2026-10-10T03:00:00Z" }],
};

describe("Observer photo replies", () => {
  it("previews photos, removes one and submits the remaining photo together with text", async () => {
    mockedSubmitInformationResponse.mockResolvedValueOnce(acceptedPhotoReply);
    const input = await openPhotoReply();
    const files = [new File(["one"], "wide.jpg", { type: "image/jpeg" }), new File(["two"], "close.webp", { type: "image/webp" })];
    fireEvent.change(input, { target: { files } });
    expect(await screen.findByRole("img", { name: "Selected photo: wide.jpg" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1: wide.jpg" }));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
    await waitFor(() => expect(mockedSubmitInformationResponse).toHaveBeenCalledWith("RC-0241", { responseText: "Wider view attached." }, [files[1]]));
    expect(await screen.findByRole("status")).toHaveTextContent("attached to this report");
    expect(screen.queryByLabelText("Additional photos (optional)")).not.toBeInTheDocument();
  });

  it("enforces the five-photo limit across multiple selections", async () => {
    const input = await openPhotoReply();
    const files = Array.from({ length: 5 }, (_, i) => new File(["photo"], `${i}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(input, { target: { files } });
    fireEvent.change(input, { target: { files: [new File(["extra"], "extra.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("up to 5 photos");
    expect(screen.getAllByRole("img", { name: /Selected photo:/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Submit additional information" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1: 0.jpg" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit additional information" })).toBeEnabled();
  });

  it.each(["wrong type", "empty", "too large"])("rejects a %s photo before sending", async (kind) => {
    const input = await openPhotoReply();
    const file = new File(kind === "empty" ? [] : ["photo"], "photo.jpg", { type: kind === "wrong type" ? "image/gif" : "image/jpeg" });
    if (kind === "too large") Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("alert")).toHaveTextContent("non-empty JPG, PNG or WebP");
    expect(mockedSubmitInformationResponse).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: /Selected photo:/ })).not.toBeInTheDocument();
  });

  it("keeps text and files after a server failure so the complete reply can be retried", async () => {
    mockedSubmitInformationResponse.mockRejectedValueOnce(new ApiError("Unavailable", 500)).mockResolvedValueOnce(acceptedPhotoReply);
    const input = await openPhotoReply();
    const file = new File(["photo"], "wide.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByLabelText("Additional details")).toHaveValue("Wider view attached.");
    expect(screen.getByRole("img", { name: "Selected photo: wide.jpg" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
    await screen.findByRole("status");
    expect(mockedSubmitInformationResponse).toHaveBeenNthCalledWith(2, "RC-0241", { responseText: "Wider view attached." }, [file]);
  });

  it("still requires written details when photos have been selected", async () => {
    const input = await openPhotoReply();
    fireEvent.change(input, { target: { files: [new File(["photo"], "reef.png", { type: "image/png" })] } });
    fireEvent.change(screen.getByLabelText("Additional details"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add the requested details");
    expect(mockedSubmitInformationResponse).not.toHaveBeenCalled();
  });

  it.each([[409, "already be answered or closed"], [413, "exceeds the upload limit"]])("explains a backend %s rejection", async (status, message) => {
    mockedSubmitInformationResponse.mockRejectedValueOnce(new ApiError("Rejected", status));
    await openPhotoReply();
    fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("locks the form while sending and prevents duplicate requests", async () => {
    let resolve!: (result: typeof acceptedPhotoReply) => void;
    mockedSubmitInformationResponse.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const input = await openPhotoReply();
    const submit = screen.getByRole("button", { name: "Submit additional information" });
    fireEvent.click(submit); fireEvent.click(submit);
    expect(mockedSubmitInformationResponse).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();
    expect(screen.getByLabelText("Additional details")).toBeDisabled();
    resolve(acceptedPhotoReply);
    await screen.findByRole("status");
  });
});


it("lets the Observer clear an invalid photo selection and send a text-only answer", async () => {
  mockedSubmitInformationResponse.mockResolvedValueOnce({ ...acceptedPhotoReply, evidence: [] });
  const input = await openPhotoReply();
  fireEvent.change(input, { target: { files: [new File(["bad"], "bad.gif", { type: "image/gif" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Clear photo selection" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Submit additional information" }));
  await screen.findByRole("status");
  expect(mockedSubmitInformationResponse).toHaveBeenCalledWith("RC-0241", { responseText: "Wider view attached." }, []);
});

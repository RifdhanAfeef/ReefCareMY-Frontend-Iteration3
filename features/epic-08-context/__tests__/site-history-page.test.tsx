import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiveSites } from "@/lib/api/referenceApi";
import { getSiteHistory } from "@/lib/api/iteration3Api";
import { SiteHistoryPage } from "../site-history-page";

vi.mock("@/lib/api/referenceApi");
vi.mock("@/lib/api/iteration3Api");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDiveSites).mockResolvedValue([
    { diveSiteId: 1, name: "Batu Nisan", publicAreaLabel: "Perhentian Islands" },
    { diveSiteId: 2, name: "Shark Point", publicAreaLabel: "Tioman Island" },
    { diveSiteId: 3, name: "Coral Island", publicAreaLabel: "Tioman Island" },
  ]);
  vi.mocked(getSiteHistory).mockImplementation(async (siteId) => ({
    diveSiteId: siteId, siteName: siteId === 1 ? "Batu Nisan" : siteId === 2 ? "Shark Point" : "Coral Island",
    publicAreaLabel: siteId === 1 ? "Perhentian Islands" : "Tioman Island",
    state: "insufficient_history", message: "No recorded history yet.",
    firstRecordOn: null, lastRecordOn: null,
    counts: { observations: 0, actions: 0, monitoringVisits: 0, sourcedOutcomes: 0, observationsByAssessmentState: {} },
    items: [], hotspotNote: null,
  }));
});

describe("site history selection", () => {
  it("narrows the site list by area and name, then loads the selected history", async () => {
    render(<SiteHistoryPage />);
    expect(await screen.findByRole("heading", { name: "Batu Nisan" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Island or area" }), { target: { value: "Tioman Island" } });
    await waitFor(() => expect(getSiteHistory).toHaveBeenCalledWith(2));
    expect(screen.getByRole("combobox", { name: "Dive site" })).not.toHaveTextContent("Batu Nisan");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search dive sites" }), { target: { value: "Coral" } });
    expect(screen.getByText("1 matching dive site.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Dive site" }), { target: { value: "3" } });
    await waitFor(() => expect(getSiteHistory).toHaveBeenCalledWith(3));
    expect(await screen.findByRole("heading", { name: "Coral Island" })).toBeInTheDocument();
  });

  it("filters the selected site's timeline by inclusive dates and record type without refetching", async () => {
    vi.mocked(getSiteHistory).mockResolvedValue({
      diveSiteId: 1, siteName: "Batu Nisan", publicAreaLabel: "Perhentian Islands",
      state: "available", message: "Recorded site history available.",
      firstRecordOn: "2026-09-01", lastRecordOn: "2026-09-20",
      counts: { observations: 1, actions: 1, monitoringVisits: 1, sourcedOutcomes: 0, observationsByAssessmentState: {} },
      items: [
        { recordType: "observation", occurredOn: "2026-09-01", recordedAt: "2026-09-02", reportReference: "R-1", ownedByYou: false, threatCategoryLabel: "Anchor damage" },
        { recordType: "action", occurredOn: "2026-09-10", recordedAt: "2026-09-11", reportReference: "R-1", ownedByYou: false, recordedOutcome: "Mooring repaired" },
        { recordType: "monitoring", occurredOn: "2026-09-20", recordedAt: "2026-09-21", reportReference: null, ownedByYou: false, conditionLabel: "Stable" },
      ], hotspotNote: null,
    });
    render(<SiteHistoryPage />);
    expect(await screen.findByText("Anchor damage")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "From date, format dd/mm/yyyy" }), { target: { value: "10/09/2026" } });
    fireEvent.change(screen.getByRole("textbox", { name: "To date, format dd/mm/yyyy" }), { target: { value: "10/09/2026" } });
    expect(screen.getByText("Mooring repaired")).toBeInTheDocument();
    expect(screen.queryByText("Anchor damage")).not.toBeInTheDocument();
    expect(screen.queryByText("Monitoring visit")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Record type" }), { target: { value: "observation" } });
    expect(screen.getByText(/No records match these filters/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Anchor damage")).toBeInTheDocument();
    expect(getSiteHistory).toHaveBeenCalledTimes(1);
  });
});

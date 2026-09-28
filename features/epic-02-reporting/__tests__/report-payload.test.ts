import { describe, expect, it } from "vitest";
import { initialLocationDraft, initialReportDraft } from "@/features/shared/mock-app-state";
import { buildReportCompletenessPayload, buildReportSubmissionPayload } from "../report-payload";

describe("report submission boundary", () => {
  it("includes a completed observation date and time in the completeness request", () => {
    const payload = buildReportCompletenessPayload({
      ...initialReportDraft,
      observationDate: "15/09/2026",
      observationTime: "17:53",
    }, initialLocationDraft, 1);

    expect(payload.observedAt).toBe(new Date("2026-09-15T17:53:00+08:00").toISOString());
    expect(payload.evidenceCount).toBe(1);
  });

  it("converts display values to the documented camelCase API payload", () => {
    const report = {
      ...initialReportDraft,
      threatCategoryCode: "ghost_gear" as const,
      threatCategoryId: 1,
      observationDate: "27/08/2026",
      observationTime: "09:10",
      estimatedDepthMetres: "12.5",
      description: "  Net tangled around coral.  ",
    };
    const location = {
      ...initialLocationDraft,
      confidence: "within_100m" as const,
      selectedSessionId: "session-4",
      sessions: [
        {
          id: "session-4",
          backendId: 4,
          namedDiveSiteId: 13,
          site: "Temple of the Sea",
        },
      ],
      pin: { x: 50, y: 50, latitude: 5.123456, longitude: 103.123456 },
      locationSource: "map_pin" as const,
      surfaceEntryContext: "Entered from the boat north of the site",
      surfaceExitContext: "Surfaced beside the mooring line",
    };

    const result = buildReportSubmissionPayload(report, location);
    expect(result).toMatchObject({
      threatCategoryId: 1,
      estimatedDepthMetres: 12.5,
      description: "Net tangled around coral.",
      diveSessionId: 4,
      location: {
        namedDiveSiteId: 13,
        locationConfidence: "within_100m",
        locationSource: "manual_map_pin",
        mapPin: { latitude: 5.123456, longitude: 103.123456 },
        relocationNotes: "Surface entry context: Entered from the boat north of the site\nSurface exit context: Surfaced beside the mooring line",
      },
      evidenceMetadata: [],
      aiSuggestions: [],
    });
    expect(result.observedAt).toBe(new Date("2026-08-27T09:10:00+08:00").toISOString());
  });

  it("omits relocation notes when the optional surface fields are empty", () => {
    const result = buildReportSubmissionPayload({
      ...initialReportDraft,
      threatCategoryId: 1,
      observationDate: "27/08/2026",
      observationTime: "09:10",
      description: "Observed reef condition.",
    }, {
      ...initialLocationDraft,
      confidence: "dive_site_only",
      selectedSessionId: "session-4",
      sessions: [{ id: "session-4", backendId: 4, namedDiveSiteId: 13, site: "Temple of the Sea" }],
    });

    expect(result.location).not.toHaveProperty("relocationNotes");
  });

  it.each([
    ["ghost_gear", 41],
    ["coral_bleaching", 42],
    ["marine_debris", 43],
    ["physical_reef_damage", 44],
    ["unsure", 45],
  ] as const)("preserves the backend category id for %s", (threatCategoryCode, threatCategoryId) => {
    const result = buildReportSubmissionPayload(
      {
        ...initialReportDraft,
        threatCategoryCode,
        threatCategoryId,
        observationDate: "05/09/2026",
        observationTime: "10:15",
        description: "Observed reef condition.",
      },
      {
        ...initialLocationDraft,
        confidence: "dive_site_only",
        selectedSessionId: "session-1",
        sessions: [{
          id: "session-1",
          backendId: 91,
          namedDiveSiteId: 7,
          site: "Shark Point — Perhentian Islands",
        }],
      },
    );

    expect(result.threatCategoryId).toBe(threatCategoryId);
  });
});

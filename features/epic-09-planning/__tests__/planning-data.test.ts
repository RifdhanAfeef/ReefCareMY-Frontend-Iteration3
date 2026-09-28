import { beforeEach, describe, expect, it } from "vitest";
import {
  addDays,
  assess,
  bandFor,
  dateRange,
  daySummary,
  localToday,
  pastExample,
  readPlans,
  sitesIn,
  validDate,
  writePlans,
} from "../planning-data";
import { returnPathForRole } from "@/features/epic-01-access/auth-return";
const today = "2026-09-27";
describe("planning data and boundaries", () => {
  beforeEach(() => localStorage.clear());
  it("uses the Malaysia calendar across a UTC date boundary", () => {
    expect(localToday(new Date("2026-09-27T17:00:00Z"))).toBe("2026-09-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("rejects invalid dates and reversed or overly long windows", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(dateRange(today, "2026-09-26")).toEqual([]);
    expect(dateRange(today, "2027-01-01")).toEqual([]);
    expect(dateRange(today, addDays(today, 13))).toHaveLength(14);
  });
  it("uses stable threshold rules and shared values for nearby site cells", () => {
    expect(bandFor(0.8, 12)).toBe("more_favourable");
    expect(bandFor(0.9, 12)).toBe("mixed");
    expect(bandFor(0.5, 21)).toBe("less_favourable");
    expect(assess(today, "Perhentian", today, "normal", 0)).toEqual(
      assess(today, "Perhentian", today, "normal", 1),
    );
  });
  it("never extrapolates forecasts into future or past dates", () => {
    expect(assess(addDays(today, 7), "Tioman", today).band).toBe(
      "out_of_horizon",
    );
    expect(assess(addDays(today, -1), "Tioman", today).waves).toBeNull();
  });
  it("keeps provider failure and missing planning positions explicit", () => {
    expect(assess(today, "Perhentian", today, "provider").band).toBe(
      "unavailable",
    );
    const summary = daySummary(today, "Perhentian", today, "position");
    expect(summary.count).toBe(sitesIn("Perhentian").length - 1);
    expect(
      Object.values(summary.breakdown).reduce((sum, n) => sum + n, 0),
    ).toBe(summary.count);
    expect(daySummary(today, "Redang", today, "provider").count).toBe(0);
  });
  it("isolates prototype workspaces and stores intent without forecasts", () => {
    writePlans("alice", [pastExample(today)]);
    expect(readPlans("alice")).toHaveLength(1);
    expect(readPlans("bob")).toEqual([]);
    expect(readPlans("alice")[0]).not.toHaveProperty("forecast");
    localStorage.setItem("reefcare-i3-prototype-plans:bad", "{");
    expect(readPlans("bad")).toEqual([]);
  });
  it("allows Observer login return to planner without weakening role or URL boundaries", () => {
    expect(
      returnPathForRole("/plan-a-dive?site=x&date=2026-09-27", "observer"),
    ).toBe("/plan-a-dive?site=x&date=2026-09-27");
    expect(
      returnPathForRole("//evil.example/plan-a-dive", "observer"),
    ).toBeNull();
    expect(returnPathForRole("/plan-a-dive", "case_coordinator")).toBeNull();
  });
});

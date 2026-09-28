import { describe, expect, it } from "vitest";
import { dateToMalaysiaFormValues, isFutureDisplayDateTime } from "../date";

describe("isFutureDisplayDateTime", () => {
  it("rejects a later time on the current date", () => {
    const now = new Date("2026-09-11T16:51:00+08:00");

    expect(isFutureDisplayDateTime("11/09/2026", "17:00", now)).toBe(true);
    expect(isFutureDisplayDateTime("11/09/2026", "16:30", now)).toBe(false);
  });
});

describe("photo metadata date conversion", () => {
  it("converts an ISO capture time to Malaysia report form values", () => {
    expect(dateToMalaysiaFormValues("2026-09-15T09:53:21.000Z")).toEqual({
      date: "15/09/2026",
      time: "17:53",
    });
  });

  it("rejects invalid capture metadata", () => {
    expect(dateToMalaysiaFormValues("not-a-date")).toBeNull();
  });
});

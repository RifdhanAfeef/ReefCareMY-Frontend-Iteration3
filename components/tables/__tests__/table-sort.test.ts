import { describe, expect, it } from "vitest";
import { dateSortValue, prioritySortValue, sortTableRows } from "../table-sort";

describe("table sorting", () => {
  it("orders case numbers naturally, retains ties and never mutates the source", () => {
    const rows = [{ value: "RC-10", id: 1 }, { value: "rc-2", id: 2 }, { value: "RC-2", id: 3 }];
    const sorted = sortTableRows(rows, { key: "value", direction: "ascending" }, (row) => row.value);
    expect(sorted.map((row) => row.id)).toEqual([2, 3, 1]);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("keeps missing and invalid values last in both directions", () => {
    const rows = [null, 3, Number.NaN, 1, undefined];
    expect(sortTableRows(rows, { key: "value", direction: "ascending" }, (row) => row)).toEqual([1, 3, null, Number.NaN, undefined]);
    expect(sortTableRows(rows, { key: "value", direction: "descending" }, (row) => row)).toEqual([3, 1, null, Number.NaN, undefined]);
  });

  it("ranks priority by urgency and sorts dates by timestamp rather than displayed text", () => {
    const priorities = ["low", null, "HIGH", "medium", "not_set"];
    expect(sortTableRows(priorities, { key: "priority", direction: "descending" }, (row) => prioritySortValue(row)))
      .toEqual(["HIGH", "medium", "low", null, "not_set"]);
    const dates = ["2026-02-01T10:00:00Z", "bad-date", "2026-01-31T23:00:00Z", null];
    expect(sortTableRows(dates, { key: "date", direction: "descending" }, (row) => dateSortValue(row)))
      .toEqual(["2026-02-01T10:00:00Z", "2026-01-31T23:00:00Z", "bad-date", null]);
  });
});

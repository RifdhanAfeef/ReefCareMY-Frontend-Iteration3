import { describe, expect, it } from "vitest";
import { returnPathForRole, safeReturnPath } from "../auth-return";

describe("safe authentication return paths", () => {
  it("accepts a local application path", () => {
    expect(safeReturnPath("/report-a-reef?site=13")).toBe("/report-a-reef?site=13");
  });

  it("rejects absolute, protocol-relative and backslash paths", () => {
    expect(safeReturnPath("https://example.org")).toBeNull();
    expect(safeReturnPath("//example.org/report-a-reef")).toBeNull();
    expect(safeReturnPath("/\\example.org/report-a-reef")).toBeNull();
  });

  it("allows only destinations belonging to the signed-in role", () => {
    expect(returnPathForRole("/report-a-reef", "observer")).toBe("/report-a-reef");
    expect(returnPathForRole("/admin/users", "observer")).toBeNull();
    expect(returnPathForRole("/admin/users", "system_administrator")).toBe("/admin/users");
  });
});

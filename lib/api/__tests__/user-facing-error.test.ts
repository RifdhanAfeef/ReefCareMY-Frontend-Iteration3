import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { userFacingError } from "../user-facing-error";

describe("userFacingError", () => {
  it("does not expose validation details", () => {
    const error = new ApiError("String should have at least 12 characters", 422);

    expect(userFacingError(error, "Please try again.")).toBe(
      "Some information needs correcting before you can continue.",
    );
  });

  it("does not expose server error details", () => {
    const error = new ApiError("Database connection failed", 500);

    expect(userFacingError(error, "Please try again.")).toBe(
      "ReefCare MY is temporarily unavailable. Please try again shortly.",
    );
  });

  it("uses the task-specific fallback for unexpected errors", () => {
    expect(userFacingError(new Error("Internal API adapter failed"), "The report could not be loaded.")).toBe(
      "The report could not be loaded.",
    );
  });
});

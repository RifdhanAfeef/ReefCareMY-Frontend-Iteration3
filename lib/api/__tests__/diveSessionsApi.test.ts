import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import { createDiveSession, getDiveSessions } from "../diveSessionsApi";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => {
  mockedApiRequest.mockReset();
  mockedApiRequest.mockResolvedValue({} as never);
});

describe("Dive Session API", () => {
  it("lists only the authenticated observer's sessions", async () => {
    await getDiveSessions();
    expect(mockedApiRequest).toHaveBeenCalledWith({ path: "/api/v1/dive-sessions" });
  });

  it("creates a session with the backend-required date and named site", async () => {
    const payload = { namedDiveSiteId: 13, diveDate: "2026-08-27" };
    await createDiveSession(payload);
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/dive-sessions",
      method: "POST",
      body: payload,
    });
  });
});

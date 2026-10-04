import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicReportHandoff, getPublicSiteActivity } from "../publicApi";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })));
});

describe("public API", () => {
  it("loads public-safe activity without authentication", async () => {
    await getPublicSiteActivity(13);

    expect(fetch).toHaveBeenCalledWith(
      "https://reefcare-backend.vercel.app/api/v1/public/dive-sites/13/activity",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("validates the public-to-report handoff without authentication", async () => {
    await getPublicReportHandoff(19);

    expect(fetch).toHaveBeenCalledWith(
      "https://reefcare-backend.vercel.app/api/v1/public/dive-sites/19/report-handoff",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });
});

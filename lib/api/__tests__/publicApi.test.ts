import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicReportHandoff, getPublicSiteActivity, getPublicSiteContext } from "../publicApi";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })));
});

afterEach(() => window.localStorage.clear());

describe("public API", () => {
  it("reads the shared public context without leaking a stored auth token", async () => {
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      user: { id: 7, displayName: "Observer", role: "observer" },
      accessToken: "test-private-token",
    }));
    await getPublicSiteContext(13);
    expect(fetch).toHaveBeenCalledWith(
      "https://reefcare-backend.vercel.app/api/v1/public/dive-sites/13/context",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

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

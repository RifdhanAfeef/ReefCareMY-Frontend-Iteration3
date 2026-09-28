import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBlobRequest, apiRequest } from "../client";
import { writeStoredAuth } from "../token-store";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("apiRequest — request construction", () => {
  it("sends a plain object body as JSON with a JSON Content-Type", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiRequest({ path: "/api/v1/auth/register", method: "POST", body: { a: 1 } });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("passes a URLSearchParams body through untouched (fetch sets its own Content-Type)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    const body = new URLSearchParams({ username: "a@b.com", password: "secret" });
    await apiRequest({ path: "/api/v1/auth/login", method: "POST", body, auth: false });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("passes a FormData body through untouched (never sets Content-Type)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    const body = new FormData();
    body.set("payload", "{}");
    await apiRequest({ path: "/api/v1/reports", method: "POST", body });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });
});

describe("apiRequest — authentication header", () => {
  it("attaches Authorization: Bearer <token> when a session is stored", async () => {
    writeStoredAuth({
      user: { id: 1, displayName: "Sam", role: "observer" },
      accessToken: "tok-abc",
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiRequest({ path: "/api/v1/reports/mine" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok-abc");
  });

  it("omits Authorization entirely when nothing is stored", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiRequest({ path: "/api/v1/reports/mine" });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("never attaches Authorization when auth: false is passed, even with a stored session", async () => {
    writeStoredAuth({
      user: { id: 1, displayName: "Sam", role: "observer" },
      accessToken: "tok-abc",
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiRequest({ path: "/api/v1/auth/login", method: "POST", auth: false });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });
});

describe("apiRequest — error message extraction", () => {
  it("surfaces a string `detail` verbatim", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: "Invalid credentials" }, 401));

    await expect(apiRequest({ path: "/api/v1/auth/login" })).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("joins a 422 validation-error list into one readable message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          detail: [
            { loc: ["body", "password"], msg: "String should have at least 12 characters" },
          ],
        },
        422,
      ),
    );

    await expect(apiRequest({ path: "/api/v1/auth/register" })).rejects.toThrow(
      "String should have at least 12 characters",
    );
  });

  it("falls back to a generic message when the body isn't the expected shape", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not json", { status: 500 }));

    await expect(apiRequest({ path: "/api/v1/reports/mine" })).rejects.toThrow(
      "ReefCare MY could not complete the request. Please try again.",
    );
  });

  it("clears an expired stored session after an authenticated 401 response", async () => {
    writeStoredAuth({
      user: { id: 1, displayName: "Sam", role: "observer" },
      accessToken: "expired-token",
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: "Token expired" }, 401));

    await expect(apiRequest({ path: "/api/v1/reports/mine" })).rejects.toThrow("Token expired");

    expect(window.localStorage.getItem("reefcare.auth")).toBeNull();
  });
});

describe("apiRequest — slow connections", () => {
  it("stops an unresponsive request and provides a recoverable message", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const result = expect(apiRequest({ path: "/api/v1/reports/mine" })).rejects.toThrow(
      "The request took too long. Please check your connection and try again.",
    );

    await vi.advanceTimersByTimeAsync(15_000);
    await result;
  });
});

describe("apiBlobRequest", () => {
  it("returns a protected binary response without trying to parse JSON", async () => {
    writeStoredAuth({
      user: { id: 8, displayName: "Coordinator", role: "case_coordinator" },
      accessToken: "coordinator-token",
    });
    const image = new Blob(["image-bytes"], { type: "image/jpeg" });
    vi.mocked(fetch).mockResolvedValue(new Response(image, {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    }));

    const result = await apiBlobRequest({ path: "/api/v1/coordinator/reports/RC-1/evidence/13" });

    expect(result.type).toBe("image/jpeg");
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("Authorization"))
      .toBe("Bearer coordinator-token");
  });
});

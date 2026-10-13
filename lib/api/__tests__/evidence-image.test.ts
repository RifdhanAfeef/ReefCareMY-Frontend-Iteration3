import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../client";
import { prepareEvidenceImage } from "../evidence-image";
import { getObserverEvidence } from "../reportsApi";
import { getCoordinatorEvidence } from "../coordinatorApi";
import { writeStoredAuth } from "../token-store";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
const webpBytes = new Uint8Array([82, 73, 70, 70, 20, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32]);

function bytesOf(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer().then((bytes) => new Uint8Array(bytes));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("private evidence image display", () => {
  it.each(["image/heic", "image/heif", "application/octet-stream", "", "image/jpg", "image/jpeg; charset=binary"])
    ("displays converted JPEG bytes despite the response label %s", async (type) => {
      const result = await prepareEvidenceImage(new Blob([jpegBytes], { type }));
      expect(result.type).toBe("image/jpeg");
      expect(await bytesOf(result)).toEqual(jpegBytes);
    });

  it.each([[pngBytes, "image/png"], [webpBytes, "image/webp"]])
    ("recognises image bytes served as a generic download", async (bytes, type) => {
      const result = await prepareEvidenceImage(new Blob([bytes], { type: "application/octet-stream" }));
      expect(result.type).toBe(type);
      expect(await bytesOf(result)).toEqual(bytes);
    });

  it("retains a correctly labelled JPEG and reads only its first 32 bytes", async () => {
    const blob = new Blob([jpegBytes, new Uint8Array(64 * 1024)], { type: "image/jpeg" });
    const slice = vi.spyOn(blob, "slice");
    expect(await prepareEvidenceImage(blob)).toBe(blob);
    expect(slice).toHaveBeenCalledExactlyOnceWith(0, 32);
  });

  it.each([
    ["empty", new Blob([], { type: "image/jpeg" })],
    ["JSON", new Blob(['{"detail":"Private storage details"}'], { type: "image/jpeg" })],
    ["HTML", new Blob(["<html>Access denied</html>"], { type: "image/jpeg" })],
    ["SVG", new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: "image/jpeg" })],
    ["unconverted HEIC", new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], { type: "image/jpeg" })],
  ])("rejects %s instead of presenting it as a JPEG", async (_label, blob) => {
    await expect(prepareEvidenceImage(blob)).rejects.toThrow();
  });

  it("reports a header read failure without exposing response contents", async () => {
    const blob = new Blob([jpegBytes], { type: "image/jpeg" });
    vi.spyOn(blob, "slice").mockReturnValue({ arrayBuffer: () => Promise.reject(new Error("Read failed")) } as Blob);
    await expect(prepareEvidenceImage(blob)).rejects.toThrow("Read failed");
  });
});

describe("evidence API integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    ["Observer", getObserverEvidence, "observer", "/api/v1/reports/RC%2F117/evidence/27"],
    ["Coordinator", getCoordinatorEvidence, "case_coordinator", "/api/v1/coordinator/reports/RC%2F117/evidence/27"],
  ] as const)("normalises converted images through the existing %s authorisation path", async (_label, load, role, path) => {
    writeStoredAuth({ user: { id: 8, displayName: "Test user", role }, accessToken: "test-token" });
    vi.mocked(fetch).mockResolvedValue(new Response(jpegBytes, {
      headers: { "Content-Type": "image/heic" },
    }));
    const image = await load("RC/117", 27);
    expect(image.type).toBe("image/jpeg");
    expect(await bytesOf(image)).toEqual(jpegBytes);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(new RegExp(path+"$"));
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token");
  });

  it("keeps forbidden evidence forbidden", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"detail":"Not permitted"}', {
      status: 403, headers: { "Content-Type": "application/json" },
    }));
    await expect(getObserverEvidence("RC-117", 27)).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

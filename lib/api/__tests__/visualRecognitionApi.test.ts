import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "../client";
import { recognizeVisualThreat } from "../visualRecognitionApi";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

describe("Visual Threat Recognition API", () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it("sends one pre-submission image using the frozen multipart contract", async () => {
    mockedApiRequest.mockResolvedValue({
      status: "recognized",
      suggestedThreat: { code: "ghost_gear", label: "Ghost fishing gear" },
      confidence: 0.87,
      warning: null,
    });
    const photo = new File(["reef"], "reef.jpg", { type: "image/jpeg" });

    await expect(recognizeVisualThreat(photo)).resolves.toMatchObject({ status: "recognized" });
    const request = mockedApiRequest.mock.calls[0][0];
    expect(request).toMatchObject({
      path: "/api/v1/reports/visual-recognition",
      method: "POST",
      timeoutMs: 30_000,
    });
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("photo")).toBe(photo);
  });
});

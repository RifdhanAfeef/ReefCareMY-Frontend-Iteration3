import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, login, register } from "../authApi";
import * as client from "../client";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("login — request shape (backend-confirmed contract)", () => {
  it("posts username/password as application/x-www-form-urlencoded, unauthenticated", async () => {
    mockedApiRequest.mockResolvedValue({
      accessToken: "tok",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Sam", role: "observer" },
    });

    await login("observer@example.org", "s3cret-password");

    const call = mockedApiRequest.mock.calls[0][0];
    expect(call.path).toBe("/api/v1/auth/login");
    expect(call.method).toBe("POST");
    expect(call.auth).toBe(false);
    expect(call.body).toBeInstanceOf(URLSearchParams);
    expect((call.body as URLSearchParams).get("username")).toBe("observer@example.org");
    expect((call.body as URLSearchParams).get("password")).toBe("s3cret-password");
  });

  it("normalises the nested session example in backend documentation section 8.1", async () => {
    mockedApiRequest.mockResolvedValue({
      user: { id: 1, displayName: "Sam", role: "observer" },
      session: { accessToken: "tok", tokenType: "bearer", expiresIn: 3600 },
    });

    await expect(login("observer@example.org", "s3cret-password")).resolves.toEqual({
      accessToken: "tok",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Sam", role: "observer" },
    });
  });
});

describe("session endpoints", () => {
  it("loads the current role-safe user", async () => {
    mockedApiRequest.mockResolvedValue({ id: 1, displayName: "Sam", role: "observer" });
    await getCurrentUser();
    expect(mockedApiRequest).toHaveBeenCalledWith({ path: "/api/v1/auth/me" });
  });
});

describe("register — request shape (RegistrationCreate schema)", () => {
  it("posts email/displayName/password as JSON, unauthenticated, with no role field", async () => {
    mockedApiRequest.mockResolvedValue({
      id: 1,
      email: "observer@example.org",
      displayName: "Sam Observer",
      role: "observer",
    });

    await register({
      email: "observer@example.org",
      displayName: "Sam Observer",
      password: "correct-horse-battery",
    });

    const call = mockedApiRequest.mock.calls[0][0];
    expect(call.path).toBe("/api/v1/auth/register");
    expect(call.method).toBe("POST");
    expect(call.auth).toBe(false);
    expect(call.body).toEqual({
      email: "observer@example.org",
      displayName: "Sam Observer",
      password: "correct-horse-battery",
    });
    expect(call.body).not.toHaveProperty("role");
  });
});

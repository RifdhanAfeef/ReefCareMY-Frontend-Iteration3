import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../auth-context";
import { RequireAuth, RequireRole } from "../require-auth";
import * as authApi from "@/lib/api/authApi";

let mockPathname = "/my-reports";
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => mockPathname,
}));
vi.mock("@/lib/api/authApi");

beforeEach(() => {
  replace.mockClear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.mocked(authApi.getCurrentUser).mockImplementation(async () => {
    const stored = JSON.parse(window.localStorage.getItem("reefcare.auth") ?? "null") as { user?: unknown } | null;
    if (!stored?.user) throw new Error("No stored user");
    return stored.user as Awaited<ReturnType<typeof authApi.getCurrentUser>>;
  });
});

describe("US1.1 — role-based route separation", () => {
  it("preserves hotspot filters when login is required for a deep link", async () => {
    mockPathname = "/coordinator/hotspots";
    const query = "?siteId=3&observedFrom=2026-09-01&observedTo=2026-09-13";
    window.history.replaceState({}, "", mockPathname + query);
    render(<AuthProvider><RequireRole role="case_coordinator"><p>Hotspot analysis</p></RequireRole></AuthProvider>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(mockPathname + query)}`));
    expect(screen.queryByText("Hotspot analysis")).not.toBeInTheDocument();
  });
  it("redirects an observer away from the coordinator workspace", async () => {
    mockPathname = "/coordinator/report-queue";
    window.localStorage.setItem(
      "reefcare.auth",
      JSON.stringify({
        user: { id: 1, displayName: "Sam", role: "observer" },
        accessToken: "token",
      }),
    );

    render(
      <AuthProvider>
        <RequireRole role="case_coordinator">
          <p>Coordinator queue</p>
        </RequireRole>
      </AuthProvider>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/my-reports"));
    expect(screen.queryByText("Coordinator queue")).not.toBeInTheDocument();
  });

  it("allows a coordinator into the coordinator workspace", async () => {
    mockPathname = "/coordinator/report-queue";
    window.localStorage.setItem(
      "reefcare.auth",
      JSON.stringify({
        user: { id: 2, displayName: "Casey", role: "case_coordinator" },
        accessToken: "token",
      }),
    );

    render(
      <AuthProvider>
        <RequireRole role="case_coordinator">
          <p>Coordinator queue</p>
        </RequireRole>
      </AuthProvider>,
    );

    expect(await screen.findByText("Coordinator queue")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("US1.5 AC1 — authentication required to submit a report", () => {
  it("redirects an unauthenticated visitor away from the report-a-reef route", async () => {
    mockPathname = "/report-a-reef";

    render(
      <AuthProvider>
        <RequireAuth>
          <p>Report form</p>
        </RequireAuth>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?next=%2Freport-a-reef");
    });
    expect(screen.queryByText("Report form")).not.toBeInTheDocument();
  });

  it("preserves selected reporting context in the return path", async () => {
    mockPathname = "/report-a-reef";
    window.history.replaceState({}, "", "/report-a-reef?site=13&threat=ghost_gear");

    render(
      <AuthProvider>
        <RequireAuth>
          <p>Report form</p>
        </RequireAuth>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Freport-a-reef%3Fsite%3D13%26threat%3Dghost_gear",
      );
    });
  });
});

describe("US1.5 AC2 — authentication required for My Reports", () => {
  it("redirects an unauthenticated visitor away from my-reports", async () => {
    mockPathname = "/my-reports";

    render(
      <AuthProvider>
        <RequireAuth>
          <p>My reports content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fmy-reports");
    });
    expect(screen.queryByText("My reports content")).not.toBeInTheDocument();
  });

  it("does not redirect a visitor who is already signed in", async () => {
    window.localStorage.setItem(
      "reefcare.auth",
      JSON.stringify({
        user: { id: 1, displayName: "Sam", role: "observer" },
        accessToken: "token",
      }),
    );

    render(
      <AuthProvider>
        <RequireAuth>
          <p>My reports content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(await screen.findByText("My reports content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

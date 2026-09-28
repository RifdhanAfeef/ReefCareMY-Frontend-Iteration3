import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../auth-context";
import { LoginForm } from "../login-form";
import * as authApi from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/client";

vi.mock("@/lib/api/authApi");
const mockedLogin = vi.mocked(authApi.login);

const push = vi.fn();
let queryString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryString),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function SignedInUser() {
  const { user, accessToken } = useAuth();
  return (
    <p>
      Signed in as {user?.displayName ?? "nobody"}, token {accessToken ?? "none"}
    </p>
  );
}

beforeEach(() => {
  push.mockClear();
  mockedLogin.mockReset();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/login");
});

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: /log in|signing in/i }));
  return user;
}

describe("Login — generic credential error", () => {
  it("shows a user-safe credential message", async () => {
    mockedLogin.mockRejectedValue(new ApiError("Invalid credentials", 401));

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );

    await fillAndSubmit("observer@example.org", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/invalid credentials|backend|API|401/i);
  });
});

describe("Login — button is disabled and shows a loading state while submitting", () => {
  it("disables the button and swaps its label until the request settles", async () => {
    const pending = deferred<Awaited<ReturnType<typeof authApi.login>>>();
    mockedLogin.mockReturnValue(pending.promise);

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "observer@example.org");
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");

    const button = screen.getByRole("button", { name: /log in/i });
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/signing in/i);

    pending.resolve({
      accessToken: "tok-abc",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "observer", role: "observer" },
    });

    await screen.findByRole("button", { name: "Log in" });
  });
});

describe("Login — success stores the session and navigates onward", () => {
  it.each(["case_coordinator", "observer"] as const)("restores a hotspot link only for an authorised role: %s", async (role) => {
    const destination = "/coordinator/hotspots?siteId=1&observedFrom=2026-09-01&observedTo=2026-09-13";
    window.history.replaceState({}, "", `/login?next=${encodeURIComponent(destination)}`);
    mockedLogin.mockResolvedValue({ accessToken: "test-token", tokenType: "bearer", expiresIn: 3600, user: { id: 8, displayName: "Test User", role } });
    render(<AuthProvider><LoginForm /></AuthProvider>);
    await fillAndSubmit("test@example.org", "secure-password");
    expect(push).toHaveBeenCalledWith(role === "case_coordinator" ? destination : "/");
  });
  it("persists the access token to localStorage and exposes it via context", async () => {
    mockedLogin.mockResolvedValue({
      accessToken: "tok-abc",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "observer", role: "observer" },
    });

    render(
      <AuthProvider>
        <LoginForm />
        <SignedInUser />
      </AuthProvider>,
    );

    await fillAndSubmit("observer@example.org", "correct-horse-battery");

    expect(
      await screen.findByText("Signed in as observer, token tok-abc"),
    ).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/");
    expect(mockedLogin).toHaveBeenCalledWith("observer@example.org", "correct-horse-battery");

    const stored = JSON.parse(window.localStorage.getItem("reefcare.auth") ?? "null");
    expect(stored?.user?.displayName).toBe("observer");
    expect(stored?.accessToken).toBe("tok-abc");
  });

  it("takes a coordinator directly to the report queue", async () => {
    mockedLogin.mockResolvedValue({
      accessToken: "coordinator-token",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 8, displayName: "Coordinator One", role: "case_coordinator" },
    });

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );

    await fillAndSubmit("coordinator@example.org", "secure-password");

    expect(push).toHaveBeenCalledWith("/coordinator/report-queue");
  });

  it("returns an observer to the reporting flow they intended to open", async () => {
    queryString = "next=%2Freport-a-reef%3Fsite%3D13";
    mockedLogin.mockResolvedValue({
      accessToken: "observer-token",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Observer", role: "observer" },
    });

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );
    await fillAndSubmit("observer@example.org", "correct-horse-battery");

    expect(push).toHaveBeenCalledWith("/report-a-reef?site=13");
  });

  it("does not send an observer into an administrator route", async () => {
    queryString = "next=%2Fadmin%2Fusers";
    mockedLogin.mockResolvedValue({
      accessToken: "observer-token",
      tokenType: "bearer",
      expiresIn: 3600,
      user: { id: 1, displayName: "Observer", role: "observer" },
    });

    render(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>,
    );
    await fillAndSubmit("observer@example.org", "correct-horse-battery");

    expect(push).toHaveBeenCalledWith("/");
  });
});

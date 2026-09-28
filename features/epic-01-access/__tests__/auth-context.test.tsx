import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/lib/api/authApi";
import { AuthProvider, useAuth } from "../auth-context";

vi.mock("@/lib/api/authApi");
const mockedGetCurrentUser = vi.mocked(authApi.getCurrentUser);

function SessionProbe() {
  const { status, user, logout } = useAuth();
  return <div>
    <p>{status}</p>
    <p>{user?.displayName ?? "No user"}</p>
    <button type="button" onClick={() => void logout()}>Log out</button>
  </div>;
}

beforeEach(() => {
  window.localStorage.clear();
  mockedGetCurrentUser.mockReset();
});

describe("AuthProvider logout", () => {
  it("clears the local bearer-token session without calling an unsupported logout endpoint", async () => {
    const user = { id: 8, displayName: "Current Coordinator", role: "case_coordinator" as const };
    window.localStorage.setItem("reefcare.auth", JSON.stringify({
      accessToken: "coordinator-token",
      user,
    }));
    mockedGetCurrentUser.mockResolvedValue(user);

    render(<AuthProvider><SessionProbe /></AuthProvider>);

    expect(await screen.findByText("Current Coordinator")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(window.localStorage.getItem("reefcare.auth")).toBeNull());
    expect(screen.getByText("unauthenticated")).toBeInTheDocument();
    expect(screen.getByText("No user")).toBeInTheDocument();
  });
});

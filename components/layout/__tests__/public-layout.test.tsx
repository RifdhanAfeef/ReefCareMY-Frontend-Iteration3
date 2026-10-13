import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicLayout from "@/app/(public)/layout";
import { AuthProvider } from "@/features/epic-01-access/auth-context";
import { getCurrentUser } from "@/lib/api/authApi";
import { writeStoredAuth } from "@/lib/api/token-store";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import type { HeaderAction, NavigationItem } from "@/config/navigation";

vi.mock("@/lib/api/authApi");
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ actions, navigation, children }: { actions: HeaderAction[]; navigation: NavigationItem[]; children: React.ReactNode }) => <>
    <nav>{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <header>{actions.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</header>
    <main>{children}</main>
  </>,
}));

const user: AuthUser = { id: 7, displayName: "Observer", role: "observer" };
const page = () => <AuthProvider><PublicLayout>Public page</PublicLayout></AuthProvider>;

beforeEach(() => { window.localStorage.clear(); vi.mocked(getCurrentUser).mockReset(); });

describe("public header account controls", () => {
  it("includes Log in and Create account in the server HTML before hydration", () => {
    const html = renderToString(page());
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
    expect(html).toContain("Log in");
    expect(html).toContain("Create account");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("does not hide account links while a slow saved-session check is pending", async () => {
    writeStoredAuth({ user, accessToken: "test-token" });
    let resolve!: (user: AuthUser) => void;
    vi.mocked(getCurrentUser).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(page());
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Reports" })).not.toBeInTheDocument();
    await act(async () => { resolve(user); });
    expect(await screen.findByRole("link", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Reports" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("keeps account links available when the saved session is expired", async () => {
    writeStoredAuth({ user, accessToken: "expired-token" });
    vi.mocked(getCurrentUser).mockRejectedValue(new ApiError("Expired", 401));
    render(page());
    await waitFor(() => expect(window.localStorage.getItem("reefcare.auth")).toBeNull());
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log out" })).not.toBeInTheDocument();
  });
});

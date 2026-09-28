import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicLayout from "../layout";

vi.stubGlobal("scrollTo", vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => ({ status: "anonymous", user: null, logout: vi.fn() }),
}));

describe("public home layout", () => {
  it("shows the registration action in the home-page header", () => {
    render(
      <PublicLayout>
        <h1>Home</h1>
      </PublicLayout>,
    );

    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
  });
});

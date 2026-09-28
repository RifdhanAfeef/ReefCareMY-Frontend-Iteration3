import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import * as adminApi from "@/lib/api/adminApi";
import { NewUserForm } from "../new-user-form";
import { UserDirectory } from "../user-directory";

vi.mock("@/lib/api/adminApi");
const mockedGetAdminUsers = vi.mocked(adminApi.getAdminUsers);
const mockedCreateAdminUser = vi.mocked(adminApi.createAdminUser);
const mockedUpdateAdminUser = vi.mocked(adminApi.updateAdminUser);
const mockedApproveCoordinator = vi.mocked(adminApi.approveCoordinator);
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const observer = {
  id: 12,
  email: "observer@example.org",
  displayName: "Existing Observer",
  role: "observer" as const,
  isActive: true,
  createdAt: "2026-09-13T10:00:00Z",
};

beforeEach(() => {
  push.mockClear();
  mockedGetAdminUsers.mockReset();
  mockedCreateAdminUser.mockReset();
  mockedUpdateAdminUser.mockReset();
  mockedApproveCoordinator.mockReset();
});

async function completeCreateForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Display name"), "Farah Aziz");
  await user.type(screen.getByLabelText("Email"), "farah@example.org");
  await user.type(screen.getByLabelText("Temporary password"), "temporary-pass-2026");
  await user.type(screen.getByLabelText("Confirm temporary password"), "temporary-pass-2026");
  return user;
}

describe("Administrator account creation", () => {
  it("creates only a Registered Observer account", async () => {
    mockedCreateAdminUser.mockResolvedValue({ ...observer, displayName: "Farah Aziz", email: "farah@example.org" });
    render(<NewUserForm />);
    const user = await completeCreateForm();

    expect(screen.queryByLabelText("Account role")).not.toBeInTheDocument();
    expect(screen.getByText(/Coordinator access can be approved later from the user directory/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create user account" }));

    expect(mockedCreateAdminUser).toHaveBeenCalledWith({
      displayName: "Farah Aziz",
      email: "farah@example.org",
      password: "temporary-pass-2026",
      role: "observer",
    });
    expect(mockedApproveCoordinator).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin/users");
  });

  it("shows a user-facing duplicate-email message", async () => {
    mockedCreateAdminUser.mockRejectedValue(new ApiError("duplicate key", 409));
    render(<NewUserForm />);
    const user = await completeCreateForm();
    await user.click(screen.getByRole("button", { name: "Create user account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/duplicate|backend|API|409/i);
  });
});

describe("Administrator user directory", () => {
  it("loads real accounts and saves safe account changes", async () => {
    mockedGetAdminUsers.mockResolvedValue({ items: [observer], page: 1, pageSize: 100, total: 1 });
    mockedUpdateAdminUser.mockResolvedValue({ ...observer, displayName: "Updated Observer", isActive: false });
    render(<UserDirectory />);

    const userName = await screen.findByText("Existing Observer");
    const row = userName.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("Registered Observer")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Manage account" }));
    expect(screen.getByRole("dialog", { name: "Manage Existing Observer" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Display name"));
    await user.type(screen.getByLabelText("Display name"), "Updated Observer");
    await user.selectOptions(screen.getByLabelText("Account status"), "suspended");
    await user.click(screen.getByRole("button", { name: "Save account settings" }));

    expect(mockedUpdateAdminUser).toHaveBeenCalledWith(12, { displayName: "Updated Observer", isActive: false });
    expect(await screen.findByText("Account settings for Updated Observer were saved.")).toBeInTheDocument();
  });

  it("requires a second confirmation before approving Coordinator access", async () => {
    mockedGetAdminUsers.mockResolvedValue({ items: [observer], page: 1, pageSize: 100, total: 1 });
    mockedApproveCoordinator.mockResolvedValue({ ...observer, role: "case_coordinator" });
    render(<UserDirectory />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Manage account" }));
    await user.click(screen.getByRole("button", { name: "Approve as Case Coordinator" }));
    expect(mockedApproveCoordinator).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm Coordinator access" }));

    expect(mockedApproveCoordinator).toHaveBeenCalledWith(12);
    expect(await screen.findByText("Existing Observer now has Case Coordinator access.")).toBeInTheDocument();
  });

  it("shows ten users per page and moves through the directory", async () => {
    const accounts = Array.from({ length: 12 }, (_, index) => ({
      ...observer,
      id: index + 1,
      email: `observer${index + 1}@example.org`,
      displayName: `Observer ${index + 1}`,
    }));
    mockedGetAdminUsers.mockResolvedValue({ items: accounts, page: 1, pageSize: 100, total: 12 });
    render(<UserDirectory />);

    expect(await screen.findByText("Observer 1")).toBeInTheDocument();
    expect(screen.getByText("Observer 10")).toBeInTheDocument();
    expect(screen.queryByText("Observer 11")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Observer 11")).toBeInTheDocument();
    expect(screen.getByText("Observer 12")).toBeInTheDocument();
    expect(screen.queryByText("Observer 1")).not.toBeInTheDocument();
  });
});

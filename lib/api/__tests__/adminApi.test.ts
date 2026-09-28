import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveCoordinator,
  createAdminUser,
  getAdminUsers,
  updateAdminUser,
} from "../adminApi";
import * as client from "../client";

vi.mock("../client");
const mockedApiRequest = vi.mocked(client.apiRequest);

beforeEach(() => mockedApiRequest.mockReset());

describe("administrator API", () => {
  it("loads a page of users", async () => {
    mockedApiRequest.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    await getAdminUsers();
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/admin/users?page=1&page_size=100",
    });
  });

  it("creates an Observer without a privileged role", async () => {
    const payload = {
      displayName: "New Observer",
      email: "observer@example.org",
      password: "reefcare1234",
      role: "observer" as const,
    };
    mockedApiRequest.mockResolvedValue({});
    await createAdminUser(payload);
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/admin/users",
      method: "POST",
      body: payload,
    });
  });

  it("updates only safe profile and active-state fields", async () => {
    mockedApiRequest.mockResolvedValue({});
    await updateAdminUser(12, { displayName: "Updated Name", isActive: false });
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/admin/users/12",
      method: "PATCH",
      body: { displayName: "Updated Name", isActive: false },
    });
  });

  it("uses the dedicated coordinator approval endpoint", async () => {
    mockedApiRequest.mockResolvedValue({});
    await approveCoordinator(12);
    expect(mockedApiRequest).toHaveBeenCalledWith({
      path: "/api/v1/admin/users/12/approve-coordinator",
      method: "POST",
    });
  });
});

import { apiRequest } from "./client";
import type {
  AdminUser,
  AdminUserCreate,
  AdminUserListResult,
  AdminUserUpdate,
  CoordinatorApprovalResult,
} from "./types";

export function getAdminUsers(page = 1, pageSize = 100): Promise<AdminUserListResult> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  return apiRequest<AdminUserListResult>({
    path: `/api/v1/admin/users?${query.toString()}`,
  });
}

export function createAdminUser(payload: AdminUserCreate): Promise<AdminUser> {
  return apiRequest<AdminUser>({
    path: "/api/v1/admin/users",
    method: "POST",
    body: payload,
  });
}

export function updateAdminUser(userId: number, payload: AdminUserUpdate): Promise<AdminUser> {
  return apiRequest<AdminUser>({
    path: `/api/v1/admin/users/${userId}`,
    method: "PATCH",
    body: payload,
  });
}

export function approveCoordinator(userId: number): Promise<CoordinatorApprovalResult> {
  return apiRequest<CoordinatorApprovalResult>({
    path: `/api/v1/admin/users/${userId}/approve-coordinator`,
    method: "POST",
  });
}

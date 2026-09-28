import type { AdminUserRole } from "@/lib/api/types";
import type { UserRoleCode } from "./types";

export const userRoleOptions: ReadonlyArray<{
  value: UserRoleCode;
  label: string;
}> = [
  { value: "observer", label: "Registered Observer" },
  { value: "case_coordinator", label: "Case Coordinator" },
  { value: "system_administrator", label: "System Administrator" },
];

export const adminUserRoleOptions: ReadonlyArray<{
  value: AdminUserRole;
  label: string;
}> = [
  ...userRoleOptions,
  { value: "conservation_responder", label: "Conservation Responder" },
  { value: "dive_operator", label: "Dive Operator" },
];

export function getUserRoleLabel(role: AdminUserRole) {
  return adminUserRoleOptions.find((option) => option.value === role)?.label ?? role;
}

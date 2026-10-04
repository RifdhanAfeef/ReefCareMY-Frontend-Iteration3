import { apiRequest } from "./client";

export type PlanWriteInput = {
  name: string;
  areaCode: string;
  plannedDate: string;
  diveSiteIds: number[];
};

export type SavedPlanResponse = PlanWriteInput & {
  planId: number;
  createdAt: string;
  updatedAt: string;
};

export type SavedPlanListResponse = {
  items: SavedPlanResponse[];
};

export function listPlans() {
  return apiRequest<SavedPlanListResponse>({ path: "/api/v1/plans" });
}

export function createPlan(body: PlanWriteInput) {
  return apiRequest<SavedPlanResponse>({
    path: "/api/v1/plans",
    method: "POST",
    body,
  });
}

export function getPlan(planId: number) {
  return apiRequest<SavedPlanResponse>({ path: `/api/v1/plans/${planId}` });
}

export function updatePlan(planId: number, body: PlanWriteInput) {
  return apiRequest<SavedPlanResponse>({
    path: `/api/v1/plans/${planId}`,
    method: "PATCH",
    body,
  });
}

export function deletePlan(planId: number) {
  return apiRequest<void>({
    path: `/api/v1/plans/${planId}`,
    method: "DELETE",
  });
}

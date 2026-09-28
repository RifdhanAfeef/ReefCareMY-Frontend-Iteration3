import { apiBlobRequest, apiRequest } from "./client";
import type {
  CaseClosureCreate,
  CaseClosureResult,
  CaseDecisionCreate,
  CaseDecisionResult,
  ClaimedCase,
  ConservationAction,
  ConservationActionCreate,
  ConservationActionEvidence,
  ConservationActionList,
  ConservationActionTypeOption,
  CoordinatorCase,
  CoordinatorHistoryFilters,
  CoordinatorHistoryResult,
  CoordinatorQueueResult,
  EvidenceAssessmentCreate,
  EvidenceAssessmentResult,
  InformationRequestResult,
  StartReviewResult,
} from "./types";

export async function getCoordinatorCaseHistory(
  filters: CoordinatorHistoryFilters = {},
): Promise<CoordinatorHistoryResult> {
  const query = new URLSearchParams();
  if (filters.closureReason) query.set("closureReason", filters.closureReason);
  if (filters.threatCategory) query.set("threatCategory", filters.threatCategory);
  if (filters.closedFrom) query.set("closedFrom", filters.closedFrom);
  if (filters.closedTo) query.set("closedTo", filters.closedTo);
  if (filters.wasReferred !== undefined) query.set("wasReferred", String(filters.wasReferred));
  query.set("page", String(filters.page ?? 1));
  query.set("pageSize", String(filters.pageSize ?? 20));

  return apiRequest<CoordinatorHistoryResult>({
    path: `/api/v1/coordinator/cases/history?${query.toString()}`,
  });
}

export async function getCoordinatorQueue(
  page = 1,
  pageSize = 20,
): Promise<CoordinatorQueueResult> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiRequest<CoordinatorQueueResult>({
    path: `/api/v1/coordinator/queue?${query.toString()}`,
  });
}

export async function claimReport(reportReference: string): Promise<ClaimedCase> {
  return apiRequest<ClaimedCase>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/claim`,
    method: "POST",
  });
}

export async function getCoordinatorCase(reportReference: string): Promise<CoordinatorCase> {
  return apiRequest<CoordinatorCase>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}`,
  });
}

export async function startReview(reportReference: string): Promise<StartReviewResult> {
  return apiRequest<StartReviewResult>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/start-review`,
    method: "POST",
  });
}

export async function recordEvidenceAssessment(
  reportReference: string,
  payload: EvidenceAssessmentCreate,
): Promise<EvidenceAssessmentResult> {
  return apiRequest<EvidenceAssessmentResult>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/evidence-assessment`,
    method: "POST",
    body: payload,
  });
}

export async function getCoordinatorEvidence(
  reportReference: string,
  evidenceId: number,
): Promise<Blob> {
  return apiBlobRequest({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/evidence/${encodeURIComponent(String(evidenceId))}`,
    timeoutMs: 60_000,
  });
}

export async function requestMoreInformation(
  reportReference: string,
  reason: string,
): Promise<InformationRequestResult> {
  return apiRequest<InformationRequestResult>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/information-request`,
    method: "POST",
    body: { reason },
  });
}

export async function recordCaseDecision(
  reportReference: string,
  payload: CaseDecisionCreate,
): Promise<CaseDecisionResult> {
  return apiRequest<CaseDecisionResult>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/decision`,
    method: "POST",
    body: payload,
  });
}

export async function closeCase(
  reportReference: string,
  payload: CaseClosureCreate,
): Promise<CaseClosureResult> {
  return apiRequest<CaseClosureResult>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/close`,
    method: "POST",
    body: payload,
  });
}

export async function getConservationActionTypes(): Promise<ConservationActionTypeOption[]> {
  return apiRequest<ConservationActionTypeOption[]>({
    path: "/api/v1/coordinator/action-types",
  });
}

export async function getConservationActions(
  reportReference: string,
): Promise<ConservationActionList> {
  return apiRequest<ConservationActionList>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/actions`,
  });
}

export async function createConservationAction(
  reportReference: string,
  payload: ConservationActionCreate,
): Promise<ConservationAction> {
  return apiRequest<ConservationAction>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/actions`,
    method: "POST",
    body: payload,
  });
}

export async function uploadConservationActionEvidence(
  reportReference: string,
  actionId: number,
  file: File,
): Promise<ConservationActionEvidence> {
  const formData = new FormData();
  formData.set("file", file);
  return apiRequest<ConservationActionEvidence>({
    path: `/api/v1/coordinator/reports/${encodeURIComponent(reportReference)}/actions/${encodeURIComponent(String(actionId))}/evidence`,
    method: "POST",
    body: formData,
    timeoutMs: 60_000,
  });
}

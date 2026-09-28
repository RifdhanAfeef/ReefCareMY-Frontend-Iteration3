import { apiRequest } from "./client";
import type {
  LocationCheckRequest,
  LocationCheckResponse,
  MyReportsFilters,
  MyReportsResult,
  ObserverInformationRequest,
  ObserverInformationResponseCreate,
  ObserverInformationResponseResult,
  ReportCompletenessRequest,
  ReportCompletenessResponse,
  ReportDetail,
  ReportReviewRequest,
  ReportReviewResponse,
  ReportSubmittedResult,
  ReportSubmissionPayload,
  ReportTimeline,
} from "./types";

function isReportSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  return typeof report.reportReference === "string"
    && typeof report.threatCategory === "string"
    && typeof report.generalLocation === "string"
    && typeof report.status === "string"
    && typeof report.statusLabel === "string"
    && (report.outcome === null || typeof report.outcome === "string")
    && typeof report.submittedAt === "string";
}

function parseMyReportsResult(value: unknown): MyReportsResult {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid My Reports response.");
  }
  const result = value as Record<string, unknown>;
  const validPagination = Number.isInteger(result.page) && Number(result.page) >= 1
    && Number.isInteger(result.pageSize) && Number(result.pageSize) >= 1
    && Number.isInteger(result.total) && Number(result.total) >= 0;
  if (!Array.isArray(result.items) || !result.items.every(isReportSummary) || !validPagination) {
    throw new Error("Invalid My Reports response.");
  }
  return result as unknown as MyReportsResult;
}

export async function checkReportCompleteness(payload: ReportCompletenessRequest): Promise<ReportCompletenessResponse> {
  return apiRequest<ReportCompletenessResponse>({
    path: "/api/v1/reports/completeness-check",
    method: "POST",
    body: payload,
  });
}

export async function checkReportLocation(payload: LocationCheckRequest): Promise<LocationCheckResponse> {
  return apiRequest<LocationCheckResponse>({
    path: "/api/v1/reports/location-check",
    method: "POST",
    body: payload,
  });
}

export async function reviewReport(payload: ReportReviewRequest): Promise<ReportReviewResponse> {
  return apiRequest<ReportReviewResponse>({
    path: "/api/v1/reports/review",
    method: "POST",
    body: payload,
  });
}

export async function getMyReports(filters: MyReportsFilters = {}): Promise<MyReportsResult> {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.fromDate) query.set("fromDate", filters.fromDate);
  if (filters.toDate) query.set("toDate", filters.toDate);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));

  const queryString = query.toString();
  const result = await apiRequest<unknown>({
    path: `/api/v1/reports/mine${queryString ? `?${queryString}` : ""}`,
  });
  return parseMyReportsResult(result);
}

export async function getReportDetail(reportReference: string): Promise<ReportDetail> {
  return apiRequest<ReportDetail>({
    path: `/api/v1/reports/${encodeURIComponent(reportReference)}`,
  });
}

export async function getReportTimeline(reportReference: string): Promise<ReportTimeline> {
  return apiRequest<ReportTimeline>({
    path: `/api/v1/reports/${encodeURIComponent(reportReference)}/timeline`,
  });
}

export async function getOpenInformationRequest(
  reportReference: string,
): Promise<ObserverInformationRequest | null> {
  return apiRequest<ObserverInformationRequest | null>({
    path: `/api/v1/reports/${encodeURIComponent(reportReference)}/information-request`,
  });
}

export async function submitInformationResponse(
  reportReference: string,
  payload: ObserverInformationResponseCreate,
): Promise<ObserverInformationResponseResult> {
  return apiRequest<ObserverInformationResponseResult>({
    path: `/api/v1/reports/${encodeURIComponent(reportReference)}/information-response`,
    method: "POST",
    body: payload,
  });
}

export async function submitReport(
  payload: ReportSubmissionPayload,
  photos: File[],
): Promise<ReportSubmittedResult> {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  for (const photo of photos) {
    formData.append("photos", photo);
  }

  return apiRequest<ReportSubmittedResult>({
    path: "/api/v1/reports",
    method: "POST",
    body: formData,
    timeoutMs: 60_000,
  });
}

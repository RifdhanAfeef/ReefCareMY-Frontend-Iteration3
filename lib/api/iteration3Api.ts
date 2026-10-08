import { apiRequest } from "./client";
import type {
  ExternalContext, FollowUp, FollowUpCorrection, FollowUpCreate, FollowUpList,
  MonitoringCondition, MonitoringCreate, PublicSiteContext, RejectionReason,
  RelatedComparison, RelatedDecision, RelatedReports, SiteHistory,
} from "./iteration3-types";

const casePath = (reference: string) =>
  `/api/v1/coordinator/reports/${encodeURIComponent(reference)}`;
const pairPath = (reference: string, candidate: string) =>
  `${casePath(reference)}/related-reports/${encodeURIComponent(candidate)}`;

export function getRelatedReports(reference: string, signal?: AbortSignal) {
  return apiRequest<RelatedReports>({ path: `${casePath(reference)}/related-reports`, signal });
}
export function claimAndCompare(reference: string, candidate: string) {
  return apiRequest<RelatedComparison>({ path: `${pairPath(reference, candidate)}/claim-and-compare`, method: "POST" });
}
export function compareReports(reference: string, candidate: string) {
  return apiRequest<RelatedComparison>({ path: `${pairPath(reference, candidate)}/compare` });
}
export function getRejectionReasons() {
  return apiRequest<RejectionReason[]>({ path: "/api/v1/coordinator/related-reports/rejection-reasons" });
}
export function decideRelationship(
  reference: string, candidate: string,
  payload: { decision: "same_incident" | "not_related"; rejectionReasonCode?: string; note?: string },
) {
  return apiRequest<RelatedDecision>({ path: `${pairPath(reference, candidate)}/decision`, method: "POST", body: payload });
}
export function getFollowUps(reference: string, includeSuperseded = false) {
  const query = includeSuperseded ? "?includeSuperseded=true" : "";
  return apiRequest<FollowUpList>({ path: `${casePath(reference)}/follow-ups${query}` });
}
export function getFollowUp(reference: string, caseActionId: number) {
  return apiRequest<FollowUp>({ path: `${casePath(reference)}/follow-ups/${caseActionId}` });
}
export function createFollowUp(reference: string, body: FollowUpCreate) {
  return apiRequest<FollowUp>({ path: `${casePath(reference)}/follow-ups`, method: "POST", body });
}
export function correctFollowUp(reference: string, caseActionId: number, body: FollowUpCorrection) {
  return apiRequest<FollowUp>({ path: `${casePath(reference)}/follow-ups/${caseActionId}`, method: "PATCH", body });
}
export function createMonitoring(reference: string, body: MonitoringCreate) {
  return apiRequest<FollowUp>({ path: `${casePath(reference)}/monitoring`, method: "POST", body });
}
export function getMonitoringConditions() {
  return apiRequest<MonitoringCondition[]>({ path: "/api/v1/coordinator/monitoring-conditions" });
}
export function getSiteHistory(siteId: number) {
  return apiRequest<SiteHistory>({ path: `/api/v1/coordinator/sites/${encodeURIComponent(String(siteId))}/history` });
}
export function getPublicSiteContext(siteId: number, signal?: AbortSignal) {
  return apiRequest<PublicSiteContext>({ path: `/api/v1/public/dive-sites/${encodeURIComponent(String(siteId))}/context`, auth: false, signal });
}
export function getExternalContext(siteId: number, signal?: AbortSignal) {
  return apiRequest<ExternalContext>({ path: `/api/v1/public/dive-sites/${encodeURIComponent(String(siteId))}/external-context`, auth: false, signal, timeoutMs: 30_000 });
}

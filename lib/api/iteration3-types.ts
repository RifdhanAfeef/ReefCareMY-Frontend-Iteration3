export type RelatedAnalysisState =
  | "processing"
  | "matches_available"
  | "insufficient_information"
  | "no_available_matches"
  | "unavailable";

export type RelatedSignal = { code: string; label: string; detail: string | null };
export type RelatedCandidate = {
  candidateReportReference: string;
  relatednessLevel: "high" | "medium" | "low";
  signals: RelatedSignal[];
  ownershipState: "unclaimed" | "owned_by_you";
  decisionState: "undecided" | "linked" | "not_related";
  reopenedByNewEvidence: boolean;
};
export type RelatedReports = {
  reportReference: string;
  analysisState: RelatedAnalysisState;
  message: string;
  ruleVersion: string | null;
  analysedAt: string | null;
  candidates: RelatedCandidate[];
};
export type ComparedReport = {
  reportReference: string;
  statusCode: string;
  statusLabel: string;
  threatCategoryCode: string | null;
  threatCategoryLabel: string | null;
  observedAt: string | null;
  submittedAt: string;
  diveSiteName: string | null;
  publicAreaLabel: string | null;
  locationConfidenceCode: string | null;
  estimatedDepthMetres: number | null;
  description: string | null;
  incidentReference: string | null;
  evidence: { evidenceId: number; mediaType: string; capturedAt: string | null }[];
};
export type RelatedComparison = {
  current: ComparedReport;
  candidate: ComparedReport;
  signals: RelatedSignal[];
  relatednessLevel: "high" | "medium" | "low";
  latestDecision: { decision: "same_incident" | "not_related"; decidedAt?: string } | null;
};
export type RejectionReason = { code: string; label: string; requiresNote: boolean };
export type RelatedDecision = {
  incidentReference: string | null;
  rejectionReasonCode: string | null;
  decidedBy: number;
  decidedAt: string;
};

export type FollowUpType = "action" | "sourced_outcome" | "monitoring";
export type FollowUpState = "action_planned" | "action_taken" | "outcome_recorded" | "monitoring_recorded";
export type FollowUpEvidence = {
  evidenceId: number;
  mediaType: string;
  fileSizeBytes: number | null;
  uploadedAt: string;
};
export type FollowUp = {
  caseActionId: number;
  // Older deployments may omit this field; do not assume publication status.
  isPublishable?: boolean;
  isDemonstration?: boolean;
  caseEventId: number;
  reportReference: string;
  followUpType: FollowUpType;
  followUpState: FollowUpState;
  recordingLevel: "coordinator_summary" | "responder_record" | "externally_sourced";
  actionTypeCode: string | null;
  actionTypeLabel: string | null;
  actionDate: string | null;
  responsibleTeam: string | null;
  sourceReference: string | null;
  observations: string | null;
  recordedOutcome: string | null;
  notes: string | null;
  conditionCode: string | null;
  conditionLabel: string | null;
  conditionReviewedByName: string | null;
  nextFollowUpRequired: boolean | null;
  nextFollowUpDate: string | null;
  supersedesCaseActionId: number | null;
  supersededByCaseActionId: number | null;
  statusCode: string;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  evidence: FollowUpEvidence[];
};
export type FollowUpList = { reportReference: string; items: FollowUp[]; total: number; message: string };
export type FollowUpCreate = {
  followUpType: "action" | "sourced_outcome";
  followUpState: "action_planned" | "action_taken" | "outcome_recorded";
  actionTypeCode?: string;
  recordingLevel: FollowUp["recordingLevel"];
  actionDate?: string;
  responsibleTeam?: string;
  sourceReference?: string;
  recordedOutcome?: string;
  notes?: string;
};
export type MonitoringCreate = {
  actionDate: string;
  conditionCode: string;
  observations: string;
  notes?: string;
  nextFollowUpRequired: boolean;
  nextFollowUpDate?: string;
};
export type FollowUpCorrection = {
  correctionReason: string;
  followUpState?: "action_planned" | "action_taken" | "outcome_recorded";
  actionDate?: string;
  responsibleTeam?: string;
  recordedOutcome?: string;
  notes?: string;
};
export type MonitoringCondition = { code: string; label: string; description: string | null };

export type SiteHistoryItem = {
  recordType: "observation" | "action" | "monitoring" | "sourced_outcome";
  occurredAt?: string | null;
  // Null for planned actions, which have not happened yet.
  occurredOn: string | null;
  recordedAt: string;
  threatCategoryCode?: string | null;
  threatCategoryLabel?: string | null;
  assessmentState?: string | null;
  assessmentStateLabel?: string | null;
  followUpType?: string | null;
  followUpState?: string | null;
  responsibleTeam?: string | null;
  recordedOutcome?: string | null;
  conditionCode?: string | null;
  conditionLabel?: string | null;
  nextFollowUpRequired?: boolean | null;
  nextFollowUpDate?: string | null;
  reportReference: string | null;
  ownedByYou: boolean;
};
export type SiteHistory = {
  diveSiteId: number;
  siteName: string;
  publicAreaLabel: string;
  state: "available" | "insufficient_history";
  message: string;
  firstRecordOn: string | null;
  lastRecordOn: string | null;
  counts: {
    observations: number;
    actions: number;
    monitoringVisits: number;
    sourcedOutcomes: number;
    observationsByAssessmentState: Record<string, number>;
  };
  items: SiteHistoryItem[];
  hotspotNote: string | null;
};
export type PublicSiteContext = {
  diveSiteId: number;
  siteName: string;
  publicAreaLabel: string;
  state: "available" | "no_public_context";
  message: string;
  assessmentSummary: { acceptedObservations: number; observationsUnderReview: number };
  threats: { threatCategoryCode: string; threatCategoryLabel: string; acceptedReportCount: number; mostRecentMonth: string | null }[];
  activity: { activityId: number | null; activityType: string; title: string; summary: string; activityDate: string | null; sourceLabel: string | null }[];
  interpretationNote: string;
};
export type ExternalContext = {
  diveSiteId: number;
  siteName: string;
  publicAreaLabel: string;
  state: "available" | "unavailable" | "site_position_unavailable";
  message: string;
  sourceName: string | null;
  sourceUrl: string | null;
  attribution: string | null;
  items: {
    contextType: "degree_heating_week" | "bleaching_alert_level";
    label: string;
    value: number;
    displayValue: string;
    unit: string | null;
    representedPeriodStart: string;
    representedPeriodEnd: string;
    retrievedAt: string;
    providerGridLatitude: number;
    providerGridLongitude: number;
  }[];
  showingLastStoredValues: boolean;
  interpretationNote: string;
};

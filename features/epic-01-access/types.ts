export type UserRoleCode =
  | "observer"
  | "case_coordinator"
  | "system_administrator";

export type AccountStatus = "Active" | "Pending" | "Suspended";

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRoleCode;
  status: AccountStatus;
};

export type AccessRequest = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  currentRole: UserRoleCode;
  requestedRole: "case_coordinator";
  requestedAt: string;
  status: "Pending" | "Approved" | "Rejected";
};

export type CaseActivity = {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
};

export type ReportStatusCode =
  | "draft"
  | "submitted"
  | "received"
  | "claimed"
  | "under_review"
  | "needs_more_info"
  | "evidence_accepted"
  | "monitoring"
  | "referred"
  | "response_recommended"
  | "response_planned"
  | "response_complete"
  | "closed_no_action"
  | "closed_not_substantiated"
  | "closed_no_partner"
  | "closed_logged"
  | "closed_resolved";

export type LocationConfidenceCode =
  | "exact"
  | "within_100m"
  | "within_1km"
  | "dive_site_only"
  | "unsure";

export type ClosureReasonCode =
  | "referred_other_org"
  | "monitored_no_action"
  | "not_substantiated"
  | "no_responsible_partner"
  | "logged_for_reference";

export type CaseRecord = {
  reportReference: string;
  threat: string;
  generalLocation: string;
  exactLocation: string | null;
  locationConfidenceCode: LocationConfidenceCode;
  statusCode: ReportStatusCode;
  statusLabel: string;
  submittedAt: string;
  submittedBy: string;
  observedAt: string;
  estimatedDepth: string;
  description: string;
  owner: string | null;
  claimedAt: string | null;
  closureReasonCode?: ClosureReasonCode;
  observerOutcome?: string;
  activity: CaseActivity[];
};

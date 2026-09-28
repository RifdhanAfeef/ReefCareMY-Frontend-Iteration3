import type { ClosureReasonCode, LocationConfidenceCode } from "@/features/epic-01-access/types";

export type ReviewOutcome = "not_substantiated" | "monitoring" | "referral" | "intervention" | null;

export const locationConfidenceLabels: Record<LocationConfidenceCode, string> = {
  exact: "Exact",
  within_100m: "Within approximately 100 m",
  within_1km: "Within approximately 1 km",
  dive_site_only: "Dive-site only",
  unsure: "Unsure",
};

export const closureReasons: Array<{
  value: ClosureReasonCode;
  label: string;
  observer: string;
  allowedOutcomes: ReviewOutcome[];
}> = [
  {
    value: "referred_other_org",
    label: "Referred to another organisation",
    observer: "Shared for possible response",
    allowedOutcomes: ["referral"],
  },
  {
    value: "monitored_no_action",
    label: "Monitored, no action required",
    observer: "Reviewed, no further action required at this time",
    allowedOutcomes: ["monitoring"],
  },
  {
    value: "not_substantiated",
    label: "Not substantiated",
    observer: "Could not be substantiated from the evidence provided",
    allowedOutcomes: ["not_substantiated"],
  },
  {
    value: "no_responsible_partner",
    label: "No responsible partner available",
    observer: "Recorded, but no participating response partner is currently available",
    allowedOutcomes: ["referral", "intervention"],
  },
  {
    value: "logged_for_reference",
    label: "Logged for reference",
    observer: "Recorded for future reference",
    allowedOutcomes: ["monitoring", "intervention"],
  },
];

export function statusForClosure(reason: ClosureReasonCode) {
  if (reason === "not_substantiated") return { statusCode: "closed_not_substantiated" as const, statusLabel: "Closed — Not Substantiated" };
  if (reason === "no_responsible_partner") return { statusCode: "closed_no_partner" as const, statusLabel: "Closed — No Partner Available" };
  if (reason === "logged_for_reference") return { statusCode: "closed_logged" as const, statusLabel: "Closed — Logged for Reference" };
  if (reason === "monitored_no_action") return { statusCode: "closed_no_action" as const, statusLabel: "Closed — Monitoring Recorded" };
  return { statusCode: "referred" as const, statusLabel: "Shared for Possible Response" };
}

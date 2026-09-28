import type { ReportCompletenessResponse } from "@/lib/api/types";

const labels: Record<string, string> = {
  threatcategoryid: "Possible threat type",
  threatcategory: "Possible threat type",
  observedat: "Observation date and time",
  observationdate: "Observation date",
  observationtime: "Observation time",
  description: "What you observed",
  evidence: "Photographs",
  evidencecount: "Photographs",
  photos: "Photographs",
  estimateddepthmetres: "Estimated depth",
  divesessionid: "Dive session",
  nameddiveid: "Named dive site",
  nameddivesiteid: "Named dive site",
  location: "Observation location",
  locationsource: "Location source",
  locationconfidence: "Location confidence",
};

const laterStepFields = new Set([
  "divesessionid",
  "nameddiveid",
  "nameddivesiteid",
  "location",
  "locationsource",
  "locationconfidence",
  "mappin",
  "coordinates",
]);

function normalise(item: string) {
  return item.trim().replace(/[_\-\s]+/g, "").toLowerCase();
}

function sentenceCase(item: string) {
  const spaced = item
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Report detail";
}

export function formatCompletenessItem(item: string) {
  return labels[normalise(item)] ?? sentenceCase(item);
}

export function isLaterStepCompletenessItem(item: string) {
  return laterStepFields.has(normalise(item));
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}

export function observationCompletenessDisplay(result: ReportCompletenessResponse) {
  const required = unique([...result.blockingMissing, ...result.blockingIssues])
    .filter((item) => !isLaterStepCompletenessItem(item))
    .map(formatCompletenessItem);
  const recommended = unique(result.recommendedMissing)
    .filter((item) => !isLaterStepCompletenessItem(item))
    .map(formatCompletenessItem);

  let summary = "These observation details are complete.";
  if (required.length > 0 && recommended.length > 0) {
    summary = `${required.length} required ${required.length === 1 ? "item remains" : "items remain"}; ${recommended.length} optional ${recommended.length === 1 ? "detail could" : "details could"} improve the report.`;
  } else if (required.length > 0) {
    summary = `${required.length} required ${required.length === 1 ? "item remains" : "items remain"} in this section.`;
  } else if (recommended.length > 0) {
    summary = `Required observation details are complete; ${recommended.length} optional ${recommended.length === 1 ? "detail could" : "details could"} improve the report.`;
  }

  return { required, recommended, summary };
}

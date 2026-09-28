import { apiRequest } from "./client";

export type SmartReportSuggestion = {
  field: string;
  label: string;
  suggestedValue: string | null;
};

export type SmartReportFollowUpQuestion = {
  field: string;
  question: string;
  options: string[];
};

type SmartReportWireResult = {
  available?: boolean;
  suggestions?: SmartReportSuggestion[] | Record<string, unknown>;
  missingFields?: string[];
  missingInformation?: string[];
  followUpQuestions?: SmartReportFollowUpQuestion[];
  warnings?: string[];
  message?: string;
  requiresUserConfirmation?: boolean;
};

export type SmartReportResult = {
  available: boolean;
  suggestions: SmartReportSuggestion[];
  missingFields: string[];
  followUpQuestions: SmartReportFollowUpQuestion[];
  warnings: string[];
  message?: string;
  requiresUserConfirmation: boolean;
};

function humaniseField(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function normaliseSuggestions(value: SmartReportWireResult["suggestions"]): SmartReportSuggestion[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is SmartReportSuggestion =>
      Boolean(item) && typeof item.field === "string" && typeof item.label === "string",
    );
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([field, suggestedValue]) => ({
    field,
    label: humaniseField(field),
    suggestedValue: suggestedValue == null ? null : String(suggestedValue),
  }));
}

export async function structureReportDescription(description: string): Promise<SmartReportResult> {
  const result = await apiRequest<SmartReportWireResult>({
    path: "/api/v1/reports/smart-structure",
    method: "POST",
    body: { description },
    timeoutMs: 25_000,
  });
  return {
    available: result.available !== false,
    suggestions: normaliseSuggestions(result.suggestions),
    missingFields: Array.isArray(result.missingFields)
      ? result.missingFields
      : Array.isArray(result.missingInformation) ? result.missingInformation : [],
    followUpQuestions: Array.isArray(result.followUpQuestions)
      ? result.followUpQuestions.filter((question) =>
        Boolean(question)
        && typeof question.field === "string"
        && typeof question.question === "string"
        && Array.isArray(question.options),
      )
      : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    message: result.message,
    requiresUserConfirmation: result.requiresUserConfirmation !== false,
  };
}

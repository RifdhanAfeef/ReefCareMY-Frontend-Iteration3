export type ThreatCategoryCode =
  | "ghost_gear"
  | "coral_bleaching"
  | "marine_debris"
  | "physical_reef_damage"
  | "unsure";

export type ReportPhotoMetadata = {
  id: string;
  name: string;
  type: string;
  size: number;
  capturedAt?: string | null;
  capturedAtConfirmed?: boolean;
};

export type SmartReportField =
  | "possible_threat"
  | "estimated_depth_metres"
  | "approximate_size"
  | "coral_interaction"
  | "animal_interaction"
  | "site_reference";

export type ReportAISuggestion = {
  field: SmartReportField;
  label: string;
  suggestedValue: string | null;
  status: "unresolved" | "confirmed" | "corrected" | "removed";
  conflict: boolean;
  observerValue: string | null;
};

export type ReportDraft = {
  threatCategoryCode: ThreatCategoryCode | "";
  threatCategoryId: number | null;
  observationDate: string;
  observationTime: string;
  estimatedDepthMetres: string;
  description: string;
  photos: ReportPhotoMetadata[];
  aiSuggestions: ReportAISuggestion[];
  lastSavedAt: string | null;
};

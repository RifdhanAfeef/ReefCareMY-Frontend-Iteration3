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
  source: "smart_report";
  field: SmartReportField;
  label: string;
  suggestedValue: string | null;
  confidence: null;
  status: "unresolved" | "confirmed" | "corrected" | "removed";
  conflict: boolean;
  observerValue: string | null;
};

export type VisualRecognitionStatus = "recognized" | "unsure" | "unavailable";
export type VisualRecognitionResolution = "unresolved" | "accepted" | "kept" | "changed" | "not_required";

export type ReportVisualRecognition = {
  photoId: string;
  photoName: string;
  status: VisualRecognitionStatus;
  suggestedThreatCode: ThreatCategoryCode | null;
  suggestedThreatLabel: string | null;
  confidence: number | null;
  warning: string | null;
  resolution: VisualRecognitionResolution;
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
  visualRecognition: ReportVisualRecognition | null;
  lastSavedAt: string | null;
};

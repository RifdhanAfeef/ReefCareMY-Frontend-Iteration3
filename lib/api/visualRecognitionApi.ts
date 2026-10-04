import { apiRequest } from "./client";

export type VisualRecognitionThreat = {
  code: "ghost_gear" | "coral_bleaching" | "marine_debris" | "physical_reef_damage" | "unsure";
  label: string;
};

export type VisualRecognitionResponse = {
  status: "recognized" | "unsure" | "unavailable";
  suggestedThreat: VisualRecognitionThreat | null;
  confidence: number | null;
  warning: string | null;
};

export async function recognizeVisualThreat(photo: File): Promise<VisualRecognitionResponse> {
  const body = new FormData();
  body.append("photo", photo);
  return apiRequest<VisualRecognitionResponse>({
    path: "/api/v1/reports/visual-recognition",
    method: "POST",
    body,
    timeoutMs: 30_000,
  });
}

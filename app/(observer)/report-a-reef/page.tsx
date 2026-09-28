import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { ObservationForm } from "@/features/epic-02-reporting/observation-form";

export const metadata: Metadata = { title: "Report a reef" };

const supportedThreats = new Set([
  "ghost_gear",
  "coral_bleaching",
  "marine_debris",
  "physical_reef_damage",
  "unsure",
]);

function normaliseThreatHandoff(value: string) {
  return value === "physical_damage" ? "physical_reef_damage" : value;
}

export default async function ReportAReefPage({
  searchParams,
}: {
  searchParams: Promise<{ threat?: string | string[]; source?: string | string[] }>;
}) {
  const params = await searchParams;
  const threatValue = params.threat;
  const fromExplorer = params.source === "explore" && !threatValue;
  const normalisedThreat = typeof threatValue === "string" ? normaliseThreatHandoff(threatValue) : undefined;
  const initialThreat = normalisedThreat && supportedThreats.has(normalisedThreat) ? normalisedThreat : undefined;

  return (
    <PageTemplate
      eyebrow="New observation"
      title="Tell us what you observed"
      description="Capture the reef threat, date, evidence and a short description without requiring scientific training."
      showBackButton
      backLabel="Back to reef threats"
      backFallbackHref="/reef-threats"
    >
      <ObservationForm initialThreat={initialThreat} fromExplorer={fromExplorer} />
    </PageTemplate>
  );
}

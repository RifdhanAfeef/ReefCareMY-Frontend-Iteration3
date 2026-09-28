import type { Metadata } from "next";
import { ThreatExplorer } from "@/features/epic-03-threat-explorer/threat-explorer";
import type { ThreatExplorerCode } from "@/features/epic-03-threat-explorer/threat-explorer-data";

export const metadata: Metadata = {
  title: "Reef Threat Explorer",
  description: "Learn how to recognise four common reef threats and report observations safely.",
};

const supportedThreats = new Set<ThreatExplorerCode>([
  "ghost_gear",
  "coral_bleaching",
  "marine_debris",
  "physical_reef_damage",
]);

export default async function ReefThreatsPage({
  searchParams,
}: {
  searchParams: Promise<{ threat?: string | string[] }>;
}) {
  const threatValue = (await searchParams).threat;
  const initialThreat = typeof threatValue === "string" && supportedThreats.has(threatValue as ThreatExplorerCode)
    ? threatValue as ThreatExplorerCode
    : undefined;

  return <ThreatExplorer initialThreat={initialThreat} />;
}

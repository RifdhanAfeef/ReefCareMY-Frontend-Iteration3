import type { Metadata } from "next";
import { Suspense } from "react";
import { HotspotAnalysisPage } from "@/features/epic-05-triage/hotspots/hotspot-page";
import { HotspotLoading } from "@/features/epic-05-triage/hotspots/hotspot-status";

export const metadata: Metadata = { title: "Geospatial hotspot analysis" };

export default function HotspotsPage() {
  return <Suspense fallback={<HotspotLoading />}><HotspotAnalysisPage /></Suspense>;
}

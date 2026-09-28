import type { Metadata } from "next";
import { Suspense } from "react";
import { HotspotIntakePage } from "@/features/epic-05-triage/hotspots/hotspot-intake";
import { HotspotLoading } from "@/features/epic-05-triage/hotspots/hotspot-status";

export const metadata: Metadata = { title: "Hotspot report intake" };

export default async function HotspotReportPage({ params }: { params: Promise<{ reportReference: string }> }) {
  const { reportReference } = await params;
  return <Suspense fallback={<HotspotLoading />}><HotspotIntakePage key={reportReference} reportReference={reportReference} /></Suspense>;
}

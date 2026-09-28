import type { Metadata } from "next";
import { Suspense } from "react";
import { DivePlanner } from "@/features/epic-09-planning/dive-planner";
export const metadata: Metadata = {
  title: "Plan a dive",
  description:
    "Explore seasonal references, compare forecast conditions and plan a reef-aware dive with ReefCare MY.",
};
export default function PlanPage() {
  return (
    <Suspense
      fallback={<p style={{ padding: 40 }}>Loading your dive planner…</p>}
    >
      <DivePlanner />
    </Suspense>
  );
}

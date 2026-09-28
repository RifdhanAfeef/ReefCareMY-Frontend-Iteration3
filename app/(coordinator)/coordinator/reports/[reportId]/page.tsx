import type { Metadata } from "next";
import { CoordinatorCaseRoute } from "@/features/epic-05-triage/case-workflow";

export const metadata: Metadata = { title: "Review report" };

export default async function CoordinatorReportDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ claim?: string }>;
}) {
  const { reportId } = await params;
  const { claim } = await searchParams;
  return <CoordinatorCaseRoute reportReference={reportId} startWithClaim={claim === "1"} />;
}

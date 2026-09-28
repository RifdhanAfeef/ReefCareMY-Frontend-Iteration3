import type { Metadata } from "next";
import { ReportQueue } from "@/features/epic-05-triage/report-queue";

export const metadata: Metadata = { title: "Report queue" };

export default function ReportQueuePage() {
  return <ReportQueue />;
}

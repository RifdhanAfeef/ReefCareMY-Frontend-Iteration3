import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { MyReportsList } from "@/features/epic-06-feedback/my-reports-list";

export const metadata: Metadata = { title: "My reports" };

export default function MyReportsPage() {
  return (
    <PageTemplate
      title="My reports"
      description="Follow the status of every report you have submitted and answer any questions from the coordinator."
    >
      <MyReportsList />
    </PageTemplate>
  );
}

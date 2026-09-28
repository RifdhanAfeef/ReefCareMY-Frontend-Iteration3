import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { ReportReview } from "@/features/epic-02-reporting/report-review";

export const metadata: Metadata = { title: "Review report" };

export default function ReviewReportPage() {
  return (
    <PageTemplate
      eyebrow="Before submission"
      title="Review your report"
      description="Check the evidence, observation details and protected location before lodging the report."
      showBackButton
      backLabel="Back to location"
      backFallbackHref="/report-a-reef/location"
    >
      <ReportReview />
    </PageTemplate>
  );
}

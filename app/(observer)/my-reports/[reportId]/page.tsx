import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { ReportDetail } from "@/features/epic-06-feedback/report-detail";
import { ReportTimeline } from "@/features/epic-06-feedback/report-timeline";
import styles from "@/features/epic-06-feedback/report-detail.module.css";

export const metadata: Metadata = { title: "Report status" };

export default async function ObserverReportDetailsPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  return (
    <PageTemplate
      eyebrow={`Report ${reportId}`}
      title="Report status"
      description="Review what you reported, follow its progress and respond when more information is needed."
      showBackButton
      backFallbackHref="/my-reports"
      backLabel="Back to My Reports"
    >
      <div className={styles.reportPageGrid}>
        <ReportDetail reportReference={reportId} />
        <ReportTimeline reportReference={reportId} />
      </div>
    </PageTemplate>
  );
}

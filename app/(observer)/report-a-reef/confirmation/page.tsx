import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { ReportConfirmation } from "@/features/epic-06-feedback/report-confirmation";

export const metadata: Metadata = {
  title: "Report received",
};

export default function ReportConfirmationPage() {
  return (
    <PageTemplate
      eyebrow="Report received"
      title="Thank you for reporting what you observed"
      description="Your observation is now recorded and available to the Case Coordinator intake queue."
      showBackButton={false}
    >
      <Suspense>
        <ReportConfirmation />
      </Suspense>
    </PageTemplate>
  );
}

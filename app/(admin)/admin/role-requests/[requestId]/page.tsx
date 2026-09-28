import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTemplate } from "@/components/templates/page-template";
import { AccessRequestReview } from "@/features/epic-01-access/access-request-review";
import { findAccessRequest } from "@/features/epic-01-access/mock-data";

export const metadata: Metadata = { title: "Review coordinator access" };

export default async function AccessRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = findAccessRequest(requestId);

  if (!request) notFound();

  return (
    <PageTemplate
      eyebrow="Administration / Access requests"
      title="Review coordinator access"
      description="Check the account details and approve or reject the requested Case Coordinator role."
      showBackButton
      backLabel="Back to access requests"
      backFallbackHref="/admin/role-requests"
    >
      <AccessRequestReview request={request} />
    </PageTemplate>
  );
}

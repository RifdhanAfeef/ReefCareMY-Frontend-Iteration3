import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { AccessRequestList } from "@/features/epic-01-access/access-request-list";
import { accessRequests } from "@/features/epic-01-access/mock-data";

export const metadata: Metadata = { title: "Role requests" };

export default function RoleRequestsPage() {
  return (
    <PageTemplate
      eyebrow="Administration / Access requests"
      title="Role requests"
      description="Review requests for Case Coordinator access and record each approval decision."
    >
      <AccessRequestList requests={accessRequests} />
    </PageTemplate>
  );
}

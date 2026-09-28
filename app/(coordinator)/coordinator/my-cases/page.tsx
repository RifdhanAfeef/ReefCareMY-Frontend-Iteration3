import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { MyCasesWorkspace } from "@/features/epic-01-access/my-cases-workspace";

export const metadata: Metadata = { title: "My cases" };

export default function MyCasesPage() {
  return (
    <PageTemplate
      eyebrow="My cases / Ownership"
      title="My cases"
      description="View the reports you currently own, or filter your closed-case and referral history."
    >
      <MyCasesWorkspace />
    </PageTemplate>
  );
}

import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { NewUserForm } from "@/features/epic-01-access/new-user-form";

export const metadata: Metadata = { title: "Add New User" };

export default function AddNewUserPage() {
  return (
    <PageTemplate
      eyebrow="Administration / Users & roles"
      title="Add New User"
      description="Create a Registered Observer account. Coordinator access is approved separately from the user directory."
      showBackButton
      backFallbackHref="/admin/users"
    >
      <NewUserForm />
    </PageTemplate>
  );
}

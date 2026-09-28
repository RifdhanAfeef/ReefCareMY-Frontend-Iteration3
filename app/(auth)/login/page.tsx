import { Suspense } from "react";
import type { Metadata } from "next";
import { PageTemplate } from "@/components/templates/page-template";
import { LoginForm } from "@/features/epic-01-access/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <PageTemplate
      title="Welcome back"
      description="Log in to submit observations or view reports linked to your account."
      centered
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </PageTemplate>
  );
}

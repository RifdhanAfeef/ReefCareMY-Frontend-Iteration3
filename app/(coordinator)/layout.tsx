import { AppShell } from "@/components/layout/app-shell";
import { coordinatorNavigation, signedInActions } from "@/config/navigation";
import { RequireRole } from "@/features/epic-01-access/require-auth";

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navigation={coordinatorNavigation} actions={signedInActions}>
      <RequireRole role="case_coordinator">{children}</RequireRole>
    </AppShell>
  );
}

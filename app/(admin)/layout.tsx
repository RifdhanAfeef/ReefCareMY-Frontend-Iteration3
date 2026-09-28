import { AppShell } from "@/components/layout/app-shell";
import { administratorNavigation, signedInActions } from "@/config/navigation";
import { RequireRole } from "@/features/epic-01-access/require-auth";

export default function AdministratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navigation={administratorNavigation} actions={signedInActions}>
      <RequireRole role="system_administrator">{children}</RequireRole>
    </AppShell>
  );
}

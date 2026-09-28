import { AppShell } from "@/components/layout/app-shell";
import { observerNavigation, signedInActions } from "@/config/navigation";
import { RequireRole } from "@/features/epic-01-access/require-auth";

export default function ObserverLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navigation={observerNavigation} actions={signedInActions}>
      <RequireRole role="observer">{children}</RequireRole>
    </AppShell>
  );
}

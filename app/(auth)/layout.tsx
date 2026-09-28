import { AppShell } from "@/components/layout/app-shell";
import { publicActions, publicNavigation } from "@/config/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell navigation={publicNavigation} actions={publicActions}>
      {children}
    </AppShell>
  );
}

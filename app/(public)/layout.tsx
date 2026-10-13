"use client";

import { AppShell } from "@/components/layout/app-shell";
import {
  administratorNavigation,
  coordinatorNavigation,
  observerNavigation,
  publicActions,
  publicNavigation,
  signedInActions,
} from "@/config/navigation";
import { useAuth } from "@/features/epic-01-access/auth-context";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const signedIn = status === "authenticated";
  const signedInNavigation = user?.role === "case_coordinator"
    ? coordinatorNavigation
    : user?.role === "system_administrator"
      ? administratorNavigation
      : observerNavigation;
  // Public account links also belong in the initial server render. Session
  // validation must not leave a blank header while hydration or /auth/me waits.
  const actions = signedIn ? signedInActions : publicActions;

  return (
    <AppShell
      navigation={signedIn ? signedInNavigation : publicNavigation}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}

"use client";

import { AuthProvider } from "@/features/epic-01-access/auth-context";
import { MockAppStateProvider } from "@/features/shared/mock-app-state";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MockAppStateProvider>{children}</MockAppStateProvider>
    </AuthProvider>
  );
}
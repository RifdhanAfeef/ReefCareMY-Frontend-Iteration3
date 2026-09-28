import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MockAppStateProvider, accountDraftStorageKey, initialLocationDraft, useMockAppState } from "../mock-app-state";

vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: 42, role: "observer" },
  }),
}));

beforeEach(() => window.localStorage.clear());

it("marks the account draft ready only after its saved values are restored", async () => {
  window.localStorage.setItem(accountDraftStorageKey(42), JSON.stringify({
    locationDraft: initialLocationDraft,
    reportDraft: {
      observationDate: "27/08/2026",
      observationTime: "14:10",
    },
  }));
  const readyDraftsSeen: string[] = [];

  function DraftProbe() {
    const { reportDraft, isAccountDraftRestored } = useMockAppState();
    if (isAccountDraftRestored) readyDraftsSeen.push(`${reportDraft.observationDate} ${reportDraft.observationTime}`);
    return <span>{isAccountDraftRestored ? "Ready" : "Restoring"}: {reportDraft.observationDate} {reportDraft.observationTime}</span>;
  }

  render(<MockAppStateProvider><DraftProbe /></MockAppStateProvider>);

  expect(screen.getByText(/Restoring:/)).toBeInTheDocument();
  await screen.findByText("Ready: 27/08/2026 14:10");
  await waitFor(() => expect(readyDraftsSeen).toEqual(["27/08/2026 14:10"]));
});

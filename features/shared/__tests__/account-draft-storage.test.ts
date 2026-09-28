import { describe, expect, it } from "vitest";
import { accountDraftStorageKey } from "../mock-app-state";
import { draftPhotoDatabaseName } from "@/features/epic-02-reporting/draft-storage";

describe("account-scoped report drafts", () => {
  it("uses a different local state key for each account", () => {
    expect(accountDraftStorageKey(1)).not.toBe(accountDraftStorageKey(2));
  });

  it("uses a different photo database for each account", () => {
    expect(draftPhotoDatabaseName(1)).not.toBe(draftPhotoDatabaseName(2));
  });
});

import { describe, expect, it } from "vitest";
import { observerNavigation, publicNavigation } from "@/config/navigation";

describe("Epic 3 navigation", () => {
  it("makes the public threat explorer easy to find before and after sign in", () => {
    const item = { label: "Reef threats", href: "/reef-threats" };

    expect(publicNavigation).toContainEqual(item);
    expect(observerNavigation).toContainEqual(item);
  });
});

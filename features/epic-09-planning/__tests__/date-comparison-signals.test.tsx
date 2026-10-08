import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateComparison } from "../planning-panels";
import type { DaySummaryView } from "../planning-source";
import type { Assessment } from "../planning-data";

const date = "2026-10-06";
const summary = (signals: DaySummaryView["signals"]): DaySummaryView => ({
  band: "less_favourable",
  count: 4,
  total: 4,
  breakdown: { more_favourable: 0, mixed: 0, less_favourable: 4 },
  signals,
  reasons: ["The least favourable assessable site determines the area band."],
});
const site = (waves: number | null, wind: number | null): Assessment => ({
  band: "less_favourable",
  waves,
  wind,
  rain: null,
  reason: "Wind above the mixed threshold.",
  source: "Open-Meteo",
  retrievedAt: "2026-10-06T02:44:24+08:00",
  ruleVersion: "i3-draft-1",
});
const renderWith = (signals: DaySummaryView["signals"], sites: Assessment[], sitesLoading = false) =>
  render(
    <DateComparison
      dates={[date]}
      summaries={{ status: "ready", data: { [date]: summary(signals) } }}
      onRetry={() => {}}
      siteAssessments={sites}
      sitesLoading={sitesLoading}
      total={4}
      selected={date}
      onSelect={() => {}}
      mode="api"
    />,
  );

describe("US9.2 AC2 date signals shown alongside the assessment", () => {
  it("shows rain chance next to wave and wind values", () => {
    renderWith({ waves: 0.14, wind: 20.7, rain: 98 }, [site(0.14, 20.7), site(0.1, 18)]);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("0.1–0.14 m");
    expect(status).toHaveTextContent("18–20.7 km/h");
    expect(status).toHaveTextContent("98% rain chance");
  });

  it("omits rain chance when the provider sends none", () => {
    renderWith({ waves: 0.14, wind: 20.7, rain: null }, [site(0.14, 20.7)]);
    expect(screen.getByRole("status")).not.toHaveTextContent("rain chance");
  });

  it("still shows rain chance when site wave and wind values are missing", () => {
    renderWith({ waves: null, wind: null, rain: 40 }, [site(null, null)]);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("40% rain chance");
    expect(status).not.toHaveTextContent("No forecast values available");
  });

  it("shows the wave, wind and rain values together, holding all three while sites load", () => {
    renderWith({ waves: 0.14, wind: 20.7, rain: 98 }, [], true);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading wave, wind and rain values…");
    expect(status).not.toHaveTextContent("rain chance");
    expect(status).not.toHaveTextContent("km/h");
    expect(status).not.toHaveTextContent("No forecast values available");
  });
});

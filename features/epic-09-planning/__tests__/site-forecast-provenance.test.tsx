import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { forecastProvenance, Signals } from "../planning-panels";
import { retrievedLabel, signalValue, type Assessment } from "../planning-data";

const assessment = (overrides: Partial<Assessment> = {}): Assessment => ({
  band: "mixed",
  waves: 0.3,
  wind: 19.1,
  rain: 90,
  reason: "Forecast conditions fall between the current thresholds.",
  source: "Open-Meteo",
  retrievedAt: "2026-10-06T16:20:06.587888+08:00",
  ruleVersion: "i3-draft-1",
  ...overrides,
});

describe("US9.2 AC2 / US9.3 site forecast signals", () => {
  it("shows rain chance with its unit next to wave and wind", () => {
    render(<Signals assessment={assessment()} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("Rain chance")).toBeInTheDocument();
  });

  it("omits rain chance when the provider sends none", () => {
    render(<Signals assessment={assessment({ rain: null })} />);
    expect(screen.queryByText("Rain chance")).not.toBeInTheDocument();
  });

  it("keeps the provider's wave precision so cards match the date summary range", () => {
    render(<Signals assessment={assessment({ waves: 0.14, wind: 13.3 })} />);
    expect(screen.getByText("0.14 m")).toBeInTheDocument();
    expect(screen.getByText("13.3 km/h")).toBeInTheDocument();
  });
});

describe("signal values", () => {
  it("shows at most two decimals without padding zeros", () => {
    expect(signalValue(0.14)).toBe("0.14");
    expect(signalValue(0.1)).toBe("0.1");
    expect(signalValue(1)).toBe("1");
    expect(signalValue(0.30000000000000004)).toBe("0.3");
  });
});

describe("forecast provenance", () => {
  it("names the provider and shows a readable Malaysia retrieval time", () => {
    expect(forecastProvenance(assessment(), false)).toBe(
      "Source: Open-Meteo · retrieved 6 Oct 2026, 4:20 pm MYT · rule i3-draft-1",
    );
  });

  it("leaves out parts the backend did not supply instead of printing unknown", () => {
    const text = forecastProvenance(
      assessment({ source: null, retrievedAt: null, ruleVersion: null }),
      false,
    );
    expect(text).toBe("Source: forecast provider");
    expect(text).not.toContain("unknown");
  });

  it("labels sample fixtures as samples", () => {
    expect(forecastProvenance(assessment(), true)).toMatch(/^Sample forecast fixture · retrieved/);
  });

  it("ignores missing or malformed timestamps", () => {
    expect(retrievedLabel(null)).toBeNull();
    expect(retrievedLabel("unknown")).toBeNull();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ExternalContextPanel } from "../public-site-context";
import { getExternalContext } from "@/lib/api/iteration3Api";

vi.mock("@/lib/api/iteration3Api", () => ({ getExternalContext: vi.fn() }));
beforeEach(() => vi.mocked(getExternalContext).mockReset());

it("labels NOAA values with the represented date and source", async () => {
  vi.mocked(getExternalContext).mockResolvedValue({
    diveSiteId: 19, siteName: "D'Lagoon", publicAreaLabel: "Perhentian Islands",
    state: "available", message: "Regional context is available.",
    sourceName: "NOAA Coral Reef Watch", sourceUrl: "https://coralreefwatch.noaa.gov",
    attribution: "Satellite monitoring", showingLastStoredValues: true,
    interpretationNote: "Regional satellite context, not a forecast or confirmation of a report.",
    items: [{ contextType: "degree_heating_week", label: "Degree heating weeks", value: 1.2,
      displayValue: "1.20 °C-weeks", unit: "°C-weeks", representedPeriodStart: "2026-10-03",
      representedPeriodEnd: "2026-10-03", retrievedAt: "2026-10-05T14:00:00Z",
      providerGridLatitude: 5.9, providerGridLongitude: 102.7 }],
  });
  render(<ExternalContextPanel siteId={19} />);
  expect(await screen.findByText("1.20 °C-weeks")).toBeInTheDocument();
  expect(screen.getByText("03 Oct 2026")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "NOAA Coral Reef Watch" })).toHaveAttribute("href", "https://coralreefwatch.noaa.gov");
  expect(screen.getByText(/last stored values/)).toBeInTheDocument();
  expect(getExternalContext).toHaveBeenCalledWith(19, expect.any(AbortSignal));
  expect(screen.getByText(/Heat stress builds when seawater stays unusually warm/)).toBeInTheDocument();
  expect(screen.getByText(/not a local reef assessment or forecast/)).toBeInTheDocument();
});

it("shortens unavailable copy without claiming that heat stress describes this exact reef", async () => {
  vi.mocked(getExternalContext).mockResolvedValue({
    diveSiteId: 19, siteName: "D'Lagoon", publicAreaLabel: "Perhentian Islands", state: "unavailable",
    message: "External heat-stress context is unavailable right now. Everything else on this page is unaffected.",
    sourceName: null, sourceUrl: null, attribution: null, items: [],
    showingLastStoredValues: false, interpretationNote: "A lengthy backend explanation.",
  });
  render(<ExternalContextPanel siteId={19} />);
  expect(await screen.findByText("Satellite heat-stress data is unavailable right now.")).toBeInTheDocument();
  expect(screen.queryByText(/Everything else on this page is unaffected/)).not.toBeInTheDocument();
  expect(screen.getByText(/do not confirm or rule out reported threats/)).toBeInTheDocument();
});

it("hides context when the site has no configured position", async () => {
  vi.mocked(getExternalContext).mockResolvedValue({
    diveSiteId: 19, siteName: "D'Lagoon", publicAreaLabel: "Perhentian Islands", state: "site_position_unavailable",
    message: "No position", sourceName: null, sourceUrl: null, attribution: null, items: [],
    showingLastStoredValues: false, interpretationNote: "Supplementary context only.",
  });
  const { container } = render(<ExternalContextPanel siteId={19} />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

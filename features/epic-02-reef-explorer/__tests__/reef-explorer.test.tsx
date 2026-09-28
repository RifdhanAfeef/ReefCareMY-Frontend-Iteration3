import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReefExplorer } from "../reef-explorer";
import { diveSiteCatalog } from "../dive-site-catalog";
import { reefSites } from "../reef-sites";
import { getPublicSiteActivity } from "@/lib/api/publicApi";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/dynamic", () => ({
  default: () => ({ onSelectSite }: { onSelectSite: (siteId: string) => void }) => (
    <button type="button" onClick={() => onSelectSite("tioman-tiger-reef")}>Map marker Tiger Reef</button>
  ),
}));

vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => ({ status: "anonymous", user: null }),
}));
vi.mock("@/lib/api/publicApi");

beforeEach(() => {
  vi.mocked(getPublicSiteActivity).mockReset();
  vi.mocked(getPublicSiteActivity).mockResolvedValue({
    diveSiteId: 3,
    diveSiteName: "Renggis Island",
    publicAreaLabel: "Tioman Island",
    hasActivity: false,
    items: [],
    message: "No public ReefCare activity is currently available for this site.",
  });
});

describe("Epic 2 Reef Explorer", () => {
  it("provides a sourced two-image profile for every backend dive site", () => {
    expect(reefSites).toHaveLength(24);
    expect(reefSites.map((site) => site.backendDiveSiteId).sort((a, b) => a - b)).toEqual(
      diveSiteCatalog.map((site) => site.backendDiveSiteId).sort((a, b) => a - b),
    );

    const images = reefSites.flatMap((site) => site.images);
    expect(images).toHaveLength(48);
    expect(new Set(images.map((image) => image.src)).size).toBe(48);
    images.forEach((image) => {
      expect(image.caption).toMatch(/^Illustrative marine image \(not photographed at this dive site\):/);
      expect(image.credit).toBeTruthy();
      expect(image.license).toBeTruthy();
      expect(image.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\//);
    });
  });

  it("uses sourced site-specific facts without presenting safety guidance as an attraction", () => {
    const temple = reefSites.find((site) => site.id === "perhentian-temple-of-the-sea");
    const sugarWreck = reefSites.find((site) => site.id === "perhentian-sugar-wreck");

    expect(temple?.preparation).toContain("Maximum depth listed by PADI: 25 metres.");
    expect(temple?.preparation.join(" ")).toContain("surface marker buoy");
    expect(temple?.position).toEqual([5.95912, 102.65972]);
    expect(temple?.source.url).toBe("https://www.padi.com/dive-site/malaysia/temple-of-the-sea/");
    expect(sugarWreck?.introduction).toContain("MV Union Star 17");
    expect(sugarWreck?.preparation).toContain("Maximum depth listed by PADI: 18 metres.");
    reefSites.forEach((site) => {
      expect(site.popularReasons).toHaveLength(1);
      expect(site.popularReasons).not.toContain("Responsible observation without touching or removing marine life");
    });
  });

  it("is publicly readable and keeps the detail panel in the same side-panel region", async () => {
    const user = userEvent.setup();
    render(<ReefExplorer />);

    expect(screen.getByRole("heading", { name: "Explore Malaysia's reef areas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose an island or dive site" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search dive sites")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Temple of the Sea/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/named dive sites/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));

    expect(screen.getByRole("heading", { name: "D'Lagoon" })).toBeInTheDocument();
    expect(screen.getByText(/General area only/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experience suitability" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PADI — Diving the Perhentian Islands/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Dive conditions reminder")).toHaveTextContent(
      "Conditions and requirements can change. Confirm them with a licensed operator and the relevant authority.",
    );
    expect(screen.queryByText(/does not provide individual dive clearance/i)).not.toBeInTheDocument();

    expect(screen.getByText("Image 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show next site image" }));
    expect(screen.getByText("Image 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enlarge image 2 of D'Lagoon" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show previous site image" }));

    await user.click(screen.getByRole("button", { name: "Enlarge image 1 of D'Lagoon" }));
    expect(screen.getByRole("dialog", { name: "D'Lagoon enlarged image" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close enlarged image" }));
    expect(screen.queryByRole("dialog", { name: "D'Lagoon enlarged image" })).not.toBeInTheDocument();
  });

  it("explains authentication before an anonymous visitor enters reporting", async () => {
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));
    await user.click(screen.getByRole("button", { name: "Report a Reef Threat" }));

    expect(screen.getByRole("dialog", { name: "Sign in to report this reef threat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Freport-a-reef%3Fsource%3Dexplore");
    expect(screen.getByRole("link", { name: "Create Observer account" })).toHaveAttribute("href", "/register?next=%2Freport-a-reef%3Fsource%3Dexplore");
    expect(screen.getByText(/track it, respond to information requests/i)).toBeInTheDocument();
  });

  it("shows an honest no-activity state", async () => {
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /Renggis Island/i }));

    expect(await screen.findByText("No public ReefCare activity is currently available")).toBeInTheDocument();
    expect(screen.getByText(/Only approved, privacy-safe updates appear here/i)).toBeInTheDocument();
    expect(getPublicSiteActivity).toHaveBeenCalledWith(3, expect.any(AbortSignal));
  });

  it("shows approved public-safe activity returned by the backend", async () => {
    vi.mocked(getPublicSiteActivity).mockResolvedValueOnce({
      diveSiteId: 19,
      diveSiteName: "D'Lagoon",
      publicAreaLabel: "Perhentian Islands",
      hasActivity: true,
      items: [{
        activityId: 101,
        activityType: "community_update",
        title: "ReefCare observation reviewed",
        summary: "An approved, general site update is available for this area.",
        activityDate: "2026-09-12",
        sourceLabel: "ReefCare MY",
      }],
      message: "Public-safe ReefCare activity is available for this site.",
    });
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));

    expect(await screen.findByText("ReefCare observation reviewed")).toBeInTheDocument();
    expect(screen.getByText("An approved, general site update is available for this area.")).toBeInTheDocument();
    expect(screen.getByText(/12 Sept 2026.*ReefCare MY/)).toBeInTheDocument();
  });

  it("distinguishes an API failure from a genuine no-activity state", async () => {
    vi.mocked(getPublicSiteActivity).mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Public activity is temporarily unavailable");
    expect(screen.queryByText("No public ReefCare activity is currently available")).not.toBeInTheDocument();
  });

  it("uses one stable guidance panel instead of expanding cards in the grid", async () => {
    const user = userEvent.setup();
    render(<ReefExplorer />);

    const marineDebris = screen.getByRole("button", { name: /Marine debris/i });
    expect(marineDebris).toHaveAttribute("aria-pressed", "false");
    await user.click(marineDebris);

    expect(marineDebris).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected observation guide")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reef Threat Explorer" })).toHaveAttribute(
      "href",
      "/reef-threats?threat=marine_debris",
    );
  });
});

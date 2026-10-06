import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReefExplorer } from "../reef-explorer";
import { diveSiteCatalog } from "../dive-site-catalog";
import { reefSites } from "../reef-sites";
import { getPublicReportHandoff, getPublicSiteContext } from "@/lib/api/publicApi";

const { routerPush, authState, getContext } = vi.hoisted(() => ({
  getContext: vi.fn(),
  routerPush: vi.fn(),
  authState: {
    status: "unauthenticated" as "unauthenticated" | "authenticated",
    user: null as null | { id: number; displayName: string; role: "observer" },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/dynamic", () => ({
  default: () => ({ onSelectSite }: { onSelectSite: (siteId: string) => void }) => (
    <button type="button" onClick={() => onSelectSite("tioman-tiger-reef")}>Map marker Tiger Reef</button>
  ),
}));

vi.mock("@/features/epic-01-access/auth-context", () => ({
  useAuth: () => authState,
}));
vi.mock("@/lib/api/publicApi", () => ({
  getPublicReportHandoff: vi.fn(),
  getPublicSiteContext: getContext,
}));

beforeEach(() => {
  getContext.mockReset();
  getContext.mockResolvedValue({
    diveSiteId: 3, siteName: "Renggis Island", publicAreaLabel: "Tioman Island",
    state: "no_public_context", message: "No public context is currently available.",
    assessmentSummary: { acceptedObservations: 0, observationsUnderReview: 0 },
    threats: [], activity: [],
    interpretationNote: "This is not evidence that a site is safe or free of reef threats.",
  });
  window.localStorage.clear();
  routerPush.mockReset();
  authState.status = "unauthenticated";
  authState.user = null;
  vi.mocked(getPublicReportHandoff).mockReset();
  vi.mocked(getPublicReportHandoff).mockResolvedValue({
    selectedDiveSiteId: 19,
    selectedDiveSiteName: "D'Lagoon",
    publicAreaLabel: "Perhentian Islands",
    centreLatitude: 5.905,
    centreLongitude: 102.735,
    defaultUncertaintyMetres: 1000,
    requiresAuthentication: true,
    reportingPath: "/report-a-reef",
    message: "Sign in or create an Observer account to continue reporting.",
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
    expect(screen.getByRole("link", { name: "Plan a dive" })).toHaveAttribute(
      "href",
      "/plan-a-dive?area=Perhentian&site=perhentian-d-lagoon",
    );
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

    expect(await screen.findByRole("dialog", { name: "Sign in to report this reef threat" })).toBeInTheDocument();
    expect(getPublicReportHandoff).toHaveBeenCalledWith(19);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Freport-a-reef%3Fsource%3Dexplore");
    expect(screen.getByRole("link", { name: "Create Observer account" })).toHaveAttribute("href", "/register?next=%2Freport-a-reef%3Fsource%3Dexplore");
    expect(screen.getByText(/track it, respond to information requests/i)).toBeInTheDocument();
  });

  it("does not continue when the selected site cannot be validated", async () => {
    vi.mocked(getPublicReportHandoff).mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));
    await user.click(screen.getByRole("button", { name: "Report a Reef Threat" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not start the report from this site",
    );
    expect(screen.queryByRole("dialog", { name: "Sign in to report this reef threat" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("reefcare-my-i2-selected-reef-site")).toBeNull();
  });

  it("sends a registered observer to the validated reporting path with canonical site context", async () => {
    authState.status = "authenticated";
    authState.user = { id: 7, displayName: "Observer", role: "observer" };
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));
    await user.click(screen.getByRole("button", { name: "Report a Reef Threat" }));

    expect(routerPush).toHaveBeenCalledWith("/report-a-reef?source=explore");
    expect(JSON.parse(window.localStorage.getItem("reefcare-my-i2-selected-reef-site") ?? "null"))
      .toEqual({
        id: "perhentian-d-lagoon",
        backendDiveSiteId: 19,
        name: "D'Lagoon",
        publicAreaLabel: "Perhentian Islands",
      });
  });

  it("shows an honest no-public-context state", async () => {
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /Renggis Island/i }));

    expect(await screen.findByText("No public context is currently available.")).toBeInTheDocument();
    expect(screen.getByText(/Only approved, privacy-safe updates appear here/i)).toBeInTheDocument();
    expect(getPublicSiteContext).toHaveBeenCalledWith(3, expect.any(AbortSignal));
  });

  it("shows approved public-safe activity returned by the backend", async () => {
    vi.mocked(getPublicSiteContext).mockResolvedValueOnce({
      diveSiteId: 19,
      siteName: "D'Lagoon",
      publicAreaLabel: "Perhentian Islands",
      state: "available",
      assessmentSummary: { acceptedObservations: 0, observationsUnderReview: 0 },
      threats: [],
      interpretationNote: "This is not evidence that a site is safe or free of reef threats.",
      activity: [{
        activityId: null,
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

  it("distinguishes an API failure from a genuine no-public-context state", async () => {
    vi.mocked(getPublicSiteContext).mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<ReefExplorer />);

    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Public context is temporarily unavailable");
    expect(screen.queryByText("No public context is currently available.")).not.toBeInTheDocument();
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


describe("Public site context", () => {
  it("shows accepted threat counts and month precision even without conservation activity", async () => {
    getContext.mockResolvedValueOnce({
      diveSiteId: 19, siteName: "D'Lagoon", publicAreaLabel: "Perhentian Islands",
      state: "available", message: "Reviewed observations are available.",
      assessmentSummary: { acceptedObservations: 10, observationsUnderReview: 2 },
      threats: [{ threatCategoryCode: "ghost_gear", threatCategoryLabel: "Ghost fishing gear",
        acceptedReportCount: 10, mostRecentMonth: "2026-10" }],
      activity: [], interpretationNote: "This is not evidence that a site is safe or free of reef threats.",
      reportReference: "RC-PRIVATE", observerEmail: "private@example.com",
    });
    const user = userEvent.setup();
    render(<ReefExplorer />);
    await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));
    expect(await screen.findByText(/10 accepted observations/)).toBeInTheDocument();
    expect(screen.getByText(/2 observations under review/)).toBeInTheDocument();
    expect(screen.getByText("2026-10").closest("small")).toHaveTextContent("Most recent: 2026-10");
    expect(screen.getByText(/not evidence that a site is safe/)).toBeInTheDocument();
    expect(screen.queryByText(/No public context is currently available./)).not.toBeInTheDocument();
    expect(screen.queryByText(/RC-PRIVATE|private@example.com/)).not.toBeInTheDocument();
  });
});

it("keeps pending observation counts visible when no category is eligible for publication", async () => {
  getContext.mockResolvedValueOnce({
    diveSiteId: 19, siteName: "D'Lagoon", publicAreaLabel: "Perhentian Islands",
    state: "no_public_context", message: "No reviewed category or activity is available.",
    assessmentSummary: { acceptedObservations: 0, observationsUnderReview: 3 },
    threats: [], activity: [],
    interpretationNote: "This is not evidence that a site is safe or free of reef threats.",
  });
  const user = userEvent.setup();
  render(<ReefExplorer />);
  await user.click(screen.getByRole("button", { name: /D'Lagoon/i }));
  expect(await screen.findByText(/3 observations under review/)).toBeInTheDocument();
  expect(screen.getByText("No reviewed category or activity is available.")).toBeInTheDocument();
});

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { threatCategories } from "@/features/epic-02-reporting/threat-data";
import { getPublicReportHandoff, getPublicSiteContext } from "@/lib/api/publicApi";
import type { PublicSiteContextResponse } from "@/lib/api/types";
import { diveSiteCatalog } from "./dive-site-catalog";
import { reefIslands, reefSites } from "./reef-sites";
import { storeSelectedReefSite } from "./selected-site-storage";
import type { ReefSite, ReefSiteReference } from "./types";
import { PhotoCreditLine } from "@/features/shared/photo-credit-line";
import styles from "./reef-explorer.module.css";

const ReefExplorerMap = dynamic(
  () => import("./reef-explorer-map").then((module) => module.ReefExplorerMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Loading the Malaysia map...</div>,
  },
);

// Real, credited example photos shared with the Reef Threats page.
const threatImages = {
  ghost_gear: "/images/threats/open/net-reef.webp",
  coral_bleaching: "/images/threats/open/bleaching-acropora.webp",
  marine_debris: "/images/threats/open/debris-indonesia.webp",
  physical_reef_damage: "/images/threats/open/broken-corals.webp",
  unsure: "/images/threats/open/bleaching-samoa.webp",
} as const;

function planningHref(site: ReefSiteReference) {
  const query = new URLSearchParams({
    area: site.island,
    site: site.id,
  });
  return `/plan-a-dive?${query.toString()}`;
}

function reportPath(path: string) {
  const safePath = path.startsWith("/") && !path.startsWith("//")
    ? path
    : "/report-a-reef";
  const [pathname, existingQuery = ""] = safePath.split("?", 2);
  const query = new URLSearchParams(existingQuery);
  query.set("source", "explore");
  return `${pathname}?${query.toString()}`;
}

function SiteList({
  sites,
  selectedSiteId,
  onSelect,
}: {
  sites: ReefSiteReference[];
  selectedSiteId: string | null;
  onSelect: (siteId: string) => void;
}) {
  return (
    <div className={styles.siteList}>
      {reefIslands.map((island) => {
        const islandSites = sites.filter((site) => site.island === island);
        if (islandSites.length === 0) return null;
        return (
          <section className={styles.islandGroup} key={island} aria-labelledby={`island-${island}`}>
            <div className={styles.islandHeading}>
              <h3 id={`island-${island}`}>{island}</h3>
              <span>{islandSites.length} dive {islandSites.length === 1 ? "site" : "sites"}</span>
            </div>
            {islandSites.map((site) => (
              <button
                className={styles.siteButton}
                data-selected={site.id === selectedSiteId}
                aria-pressed={site.id === selectedSiteId}
                key={site.id}
                type="button"
                onClick={() => onSelect(site.id)}
              >
                <span>{site.name}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function BasicSiteDetail({
  site,
  onBack,
  onReport,
  reportPending,
}: {
  site: ReefSiteReference;
  onBack: () => void;
  onReport: () => void;
  reportPending: boolean;
}) {
  return (
    <article className={styles.siteDetail} aria-labelledby="selected-site-heading">
      <button className={styles.backToSites} type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All reef areas
      </button>
      <p className={styles.siteArea}>{site.publicAreaLabel}</p>
      <h2 id="selected-site-heading">{site.name}</h2>
      <p className={styles.siteIntroduction}>
        Explore this recognised {site.publicAreaLabel} dive site or use it as the starting point for a reef-threat report.
      </p>
      <div className={styles.siteActions}>
        <p className={styles.planningUnavailable} role="status">
          Dive planning is not available for this site yet. You can still review the public site information or start a report.
        </p>
        <button className={styles.primaryButton} type="button" onClick={onReport} disabled={reportPending}>
          {reportPending ? "Checking selected site…" : "Report a Reef Threat"}
        </button>
        <a className={styles.secondaryButton} href="#responsible-observation">View guidance</a>
      </div>
    </article>
  );
}

function ActivityPanel({ site }: { site: ReefSite }) {
  const [context, setContext] = useState<PublicSiteContextResponse | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getPublicSiteContext(site.backendDiveSiteId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setContext(result);
        setState("loaded");
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setState("error");
      });
    return () => controller.abort();
  }, [reloadKey, site.backendDiveSiteId]);

  const retry = () => {
    setState("loading");
    setContext(null);
    setReloadKey((value) => value + 1);
  };

  const dateLabel = (item: PublicSiteContextResponse["activity"][number]) => [
    item.activityDate
      ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeZone: "UTC" })
        .format(new Date(`${item.activityDate}T00:00:00Z`))
      : null,
    item.sourceLabel,
  ].filter(Boolean).join(" · ") || "Approved public update";

  return (
    <section className={styles.activity} aria-labelledby="site-activity-heading">
      <div className={styles.sectionTitleRow}>
        <div>
          <h3 id="site-activity-heading">ReefCare observations and activity</h3>
        </div>
        <span className={styles.generalisedBadge}>General area only</span>
      </div>
      {state === "loaded" && context && (
        <p>
          {context.assessmentSummary.acceptedObservations} accepted {context.assessmentSummary.acceptedObservations === 1 ? "observation" : "observations"}
          {" · "}{context.assessmentSummary.observationsUnderReview} {context.assessmentSummary.observationsUnderReview === 1 ? "observation" : "observations"} under review
        </p>
      )}
      {state === "loading" ? (
        <div className={styles.emptyActivity} role="status">
          <strong>Loading public ReefCare context…</strong>
        </div>
      ) : state === "error" ? (
        <div className={styles.emptyActivity} role="alert">
          <strong>Public context is temporarily unavailable</strong>
          <p>Try again to load the approved public updates for this site.</p>
          <button className={styles.activityRetry} type="button" onClick={retry}>Try again</button>
        </div>
      ) : context?.state === "available" ? (
        <>
          {context.threats.length > 0 && (
            <ul className={styles.activityList} aria-label="Reviewed threat observations">
              {context.threats.map((threat) => (
                <li key={threat.threatCategoryCode}>
                  <span className={styles.activityDot} aria-hidden="true" />
                  <div>
                    <strong>{threat.threatCategoryLabel}</strong>
                    <small>{threat.acceptedReportCount} accepted {threat.acceptedReportCount === 1 ? "report" : "reports"}</small>
                    {threat.mostRecentMonth && <small>Most recent: <time dateTime={threat.mostRecentMonth}>{threat.mostRecentMonth}</time></small>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {context.activity.length > 0 && (
            <ul className={styles.activityList} aria-label="Approved conservation and monitoring updates">
              {context.activity.map((item, index) => (
                <li key={item.activityId != null ? `activity-${item.activityId}` : `follow-up-${index}`}>
                  <span className={styles.activityDot} aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{dateLabel(item)}</small>
                    <p>{item.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className={styles.emptyActivity} role="status">
          <strong>{context?.message ?? "No public ReefCare context is currently available"}</strong>
          <p>Only approved, privacy-safe updates appear here.</p>
        </div>
      )}
      {state === "loaded" && context && <p className={styles.sourceNote}>{context.interpretationNote}</p>}
    </section>
  );
}

function SiteGallery({
  site,
  onEnlargeImage,
}: {
  site: ReefSite;
  onEnlargeImage: (imageIndex: number) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const image = site.images[imageIndex];

  return (
    <section className={styles.siteGallery} aria-label={`${site.name} illustrative marine images`}>
      <figure className={styles.siteImage}>
        <button
          type="button"
          onClick={() => onEnlargeImage(imageIndex)}
          aria-label={`Enlarge image ${imageIndex + 1} of ${site.name}`}
        >
          <Image src={image.src} alt={image.alt} fill sizes="(max-width: 960px) 90vw, 30vw" />
          <span>View larger</span>
        </button>
      </figure>
      <p className={styles.imageCredit}>
        {image.caption} · Photo: <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.credit}</a> · {image.license}
      </p>
      {site.images.length > 1 && (
        <div className={styles.galleryControls}>
          <button
            type="button"
            onClick={() => setImageIndex((current) => current - 1)}
            disabled={imageIndex === 0}
            aria-label="Show previous site image"
          >
            <span aria-hidden="true">←</span>
          </button>
          <span aria-live="polite">Image {imageIndex + 1} of {site.images.length}</span>
          <button
            type="button"
            onClick={() => setImageIndex((current) => current + 1)}
            disabled={imageIndex === site.images.length - 1}
            aria-label="Show next site image"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}

function SiteDetail({
  site,
  onBack,
  onReport,
  onEnlargeImage,
  reportPending,
}: {
  site: ReefSite;
  onBack: () => void;
  onReport: () => void;
  onEnlargeImage: (imageIndex: number) => void;
  reportPending: boolean;
}) {
  return (
    <article className={styles.siteDetail} aria-labelledby="selected-site-heading">
      <button className={styles.backToSites} type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All reef areas
      </button>
      <p className={styles.siteArea}>{site.publicAreaLabel}</p>
      <h2 id="selected-site-heading">{site.name}</h2>
      <SiteGallery key={site.id} site={site} onEnlargeImage={onEnlargeImage} />
      <p className={styles.siteIntroduction}>{site.introduction}</p>

      <section className={styles.siteFacts} aria-label="Dive-site information">
        <div>
          <h3>Notable reef features</h3>
          <div className={styles.featureList}>{site.reefFeatures.map((item) => (
            <div key={item.title}><strong>{item.title}</strong><p>{item.description}</p></div>
          ))}</div>
        </div>
        <div>
          <h3>Marine life you may encounter</h3>
          <ul>{site.marineLife.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3>Why divers explore this site</h3>
          <ul>{site.popularReasons.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className={styles.experienceCard}>
          <h3>Experience suitability</h3>
          <span>{site.experience.level}</span>
          <p>{site.experience.explanation}</p>
        </div>
        <div>
          <h3>Prepare before you visit</h3>
          <ul>{site.preparation.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <p className={styles.sourceNote}>
        Source: <a href={site.source.url} target="_blank" rel="noreferrer">{site.source.label}</a>
      </p>
      <aside className={styles.conditionsNotice} aria-label="Dive conditions reminder">
        <p>
          Conditions and requirements can change. Confirm them with a licensed operator and the relevant authority.
        </p>
      </aside>

      <ActivityPanel key={site.backendDiveSiteId} site={site} />

      <div className={styles.siteActions}>
        <Link className={styles.primaryButton} href={planningHref(site)}>Plan a dive</Link>
        <button className={styles.primaryButton} type="button" onClick={onReport} disabled={reportPending}>
          {reportPending ? "Checking selected site…" : "Report a Reef Threat"}
        </button>
        <a className={styles.secondaryButton} href="#responsible-observation">View guidance</a>
      </div>
    </article>
  );
}

function ImageDialog({ site, imageIndex, onClose }: { site: ReefSite; imageIndex: number; onClose: () => void }) {
  const image = site.images[imageIndex];

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className={styles.imageDialogBackdrop} role="presentation" onMouseDown={onClose}>
      <section className={styles.imageDialog} role="dialog" aria-modal="true" aria-label={`${site.name} enlarged image`} onMouseDown={(event) => event.stopPropagation()}>
        <button className={styles.imageDialogClose} type="button" onClick={onClose} aria-label="Close enlarged image">×</button>
        <div className={styles.enlargedImage}>
          <Image src={image.src} alt={image.alt} fill sizes="90vw" priority />
        </div>
        <p>{image.alt}</p>
        <p className={styles.dialogImageCredit}>
          {image.caption} · Photo: <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.credit}</a> · {image.license}
        </p>
      </section>
    </div>
  );
}

function AuthenticationDialog({
  site,
  reportingPath,
  onClose,
}: {
  site: ReefSiteReference;
  reportingPath: string;
  onClose: () => void;
}) {
  const next = encodeURIComponent(reportingPath);

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="authentication-heading"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close sign-in prompt">×</button>
        <p className={styles.dialogSite}>{site.name} · {site.publicAreaLabel}</p>
        <h2 id="authentication-heading">Sign in to report this reef threat</h2>
        <p>
          An account links the report to you so you can track it, respond to information requests and see recorded outcomes.
        </p>
        <div className={styles.savedContext}>
          <strong>Your selected site will be saved</strong>
          <span>You can confirm or change it during the reporting workflow.</span>
        </div>
        <Link className={styles.primaryButton} href={`/login?next=${next}`}>Log in</Link>
        <Link className={styles.secondaryButton} href={`/register?next=${next}`}>Create Observer account</Link>
      </section>
    </div>
  );
}

export function ReefExplorer() {
  const { status, user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showAuthentication, setShowAuthentication] = useState(false);
  const [validatedReportingPath, setValidatedReportingPath] = useState("/report-a-reef?source=explore");
  const [reportHandoffState, setReportHandoffState] = useState<"idle" | "loading" | "error">("idle");
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null);
  const sidePanelRef = useRef<HTMLElement>(null);
  const guidanceCategories = useMemo(
    () => threatCategories.filter((category) => category.guidanceAvailable),
    [],
  );
  const [selectedGuidanceCode, setSelectedGuidanceCode] = useState(
    () => guidanceCategories[0]?.code ?? "coral_bleaching",
  );
  const selectedGuidance = guidanceCategories.find((category) => category.code === selectedGuidanceCode)
    ?? guidanceCategories[0];

  const mappedProfiles = useMemo(() => reefSites.filter((site) => site.backendDiveSiteId > 0), []);
  const selectedSite = diveSiteCatalog.find((site) => site.id === selectedSiteId) ?? null;
  const selectedProfile = reefSites.find((site) => site.id === selectedSiteId && site.backendDiveSiteId > 0) ?? null;
  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return diveSiteCatalog;
    return diveSiteCatalog.filter((site) =>
      `${site.name} ${site.island} ${site.publicAreaLabel}`.toLowerCase().includes(query),
    );
  }, [search]);

  // In the stacked mobile layout the map sits above the list, so bring the
  // chosen site's details into view instead of leaving them off-screen.
  useEffect(() => {
    if (!selectedSiteId || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(max-width: 1120px)").matches) return;
    sidePanelRef.current?.scrollIntoView?.({ block: "start" });
  }, [selectedSiteId]);

  async function startReport() {
    if (!selectedSite) return;
    if (status === "authenticated" && user?.role !== "observer") return;
    setReportHandoffState("loading");
    try {
      const handoff = await getPublicReportHandoff(selectedSite.backendDiveSiteId);
      const canonicalSite: ReefSiteReference = {
        ...selectedSite,
        backendDiveSiteId: handoff.selectedDiveSiteId,
        name: handoff.selectedDiveSiteName,
        publicAreaLabel: handoff.publicAreaLabel,
      };
      const path = reportPath(handoff.reportingPath);
      storeSelectedReefSite(canonicalSite);
      setValidatedReportingPath(path);
      setReportHandoffState("idle");
      if (status === "authenticated" && user?.role === "observer") {
        router.push(path);
        return;
      }
      setShowAuthentication(true);
    } catch {
      setReportHandoffState("error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1>Explore Malaysia&apos;s reef areas</h1>
        <p>
          Discover selected islands and dive sites, learn what to observe responsibly and see privacy-safe ReefCare activity without logging in.
        </p>
      </header>

      <section className={`${styles.explorer} ${selectedSite ? styles.explorerSelected : ""}`} aria-labelledby="explorer-heading">
        <aside className={styles.sidePanel} ref={sidePanelRef}>
          {selectedSite ? (
            selectedProfile ? (
              <SiteDetail
                site={selectedProfile}
                onBack={() => setSelectedSiteId(null)}
                onReport={startReport}
                onEnlargeImage={setEnlargedImageIndex}
                reportPending={reportHandoffState === "loading"}
              />
            ) : (
              <BasicSiteDetail
                site={selectedSite}
                onBack={() => setSelectedSiteId(null)}
                onReport={startReport}
                reportPending={reportHandoffState === "loading"}
              />
            )
          ) : (
            <>
              <h2 id="explorer-heading">Choose an island or dive site</h2>
              <label className={styles.searchField}>
                <span className="sr-only">Search reef areas</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search dive sites"
                />
              </label>
              {filteredSites.length > 0 ? (
                <SiteList sites={filteredSites} selectedSiteId={selectedSiteId} onSelect={setSelectedSiteId} />
              ) : (
                <div className={styles.noResults} role="status">
                  <strong>No matching reef areas</strong>
                  <p>Try a site, island or general-area name.</p>
                </div>
              )}
            </>
          )}
        </aside>

        <ReefExplorerMap sites={mappedProfiles} selectedSiteId={selectedSiteId} onSelectSite={setSelectedSiteId} />
      </section>

      {reportHandoffState === "loading" && (
        <p className={styles.handoffNotice} role="status">Checking the selected dive site…</p>
      )}
      {reportHandoffState === "error" && (
        <p className={styles.handoffError} role="alert">
          We could not start the report from this site. Please check your connection and try again.
        </p>
      )}

      <section className={styles.guidance} id="responsible-observation" aria-labelledby="guidance-heading">
        <div className={styles.guidanceHeading}>
          <div>
            <h2 id="guidance-heading">Know what may be useful to document</h2>
          </div>
          <p>You do not need to diagnose a reef threat scientifically.</p>
        </div>
        <div className={styles.threatGrid}>
          {guidanceCategories.map((category) => (
            <button
              className={styles.threatCard}
              data-selected={category.code === selectedGuidance?.code}
              key={category.code}
              type="button"
              aria-pressed={category.code === selectedGuidance?.code}
              aria-controls="selected-threat-guidance"
              onClick={() => setSelectedGuidanceCode(category.code)}
            >
                <Image src={threatImages[category.code]} alt="" width={72} height={54} />
                <span><strong>{category.label}</strong><small>{category.shortExplanation}</small></span>
                <span className={styles.cardAction}>{category.code === selectedGuidance?.code ? "Showing guidance" : "View guidance"}</span>
            </button>
          ))}
        </div>
        {selectedGuidance && (
          <article className={styles.threatDetail} id="selected-threat-guidance" aria-live="polite">
            <div className={styles.threatDetailHeading}>
              <Image src={threatImages[selectedGuidance.code]} alt="" width={96} height={72} />
              <div>
                <h3>{selectedGuidance.label}</h3>
                <p>{selectedGuidance.shortExplanation}</p>
              </div>
            </div>
            <div className={styles.threatDetailBody}>
              <div>
                <h4>Useful evidence</h4>
                <ul>{selectedGuidance.usefulEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <p><strong>Safety reminder:</strong> {selectedGuidance.safetyReminder}</p>
            </div>
            <Link href={`/reef-threats?threat=${selectedGuidance.code}`}>Open Reef Threat Explorer</Link>
          </article>
        )}
        <aside className={styles.safetyReminder}>
          <strong>Observe safely</strong>
          <p>Do not touch, move or attempt to remove anything unless you are trained and authorised.</p>
        </aside>
        <PhotoCreditLine className={styles.guidanceCredits} images={guidanceCategories.map((category) => threatImages[category.code])} lead="Example photos from reefs worldwide:" />
      </section>

      {selectedSite && status === "authenticated" && user?.role !== "observer" && (
        <p className={styles.roleNotice} role="status">Reporting is available to Registered Observer accounts.</p>
      )}
      {showAuthentication && selectedSite && (
        <AuthenticationDialog
          site={selectedSite}
          reportingPath={validatedReportingPath}
          onClose={() => setShowAuthentication(false)}
        />
      )}
      {selectedProfile && enlargedImageIndex !== null && (
        <ImageDialog site={selectedProfile} imageIndex={enlargedImageIndex} onClose={() => setEnlargedImageIndex(null)} />
      )}
    </div>
  );
}

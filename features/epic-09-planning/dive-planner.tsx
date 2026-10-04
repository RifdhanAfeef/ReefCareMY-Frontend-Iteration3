"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  FlaskConical,
  Info,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";
import { storeSelectedReefSite } from "@/features/epic-02-reef-explorer/selected-site-storage";
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  updatePlan,
} from "@/lib/api/plansApi";
import {
  getPlanningDates,
  getPlanningSites,
  type PlanningDay,
  type PlanningSite,
} from "@/lib/api/planningApi";
import { userFacingError } from "@/lib/api/user-facing-error";
import {
  addDays,
  areas,
  assess,
  dateLabel,
  dateRange,
  labels,
  localToday,
  pastExample,
  readPlans,
  sitesIn,
  validDate,
  writePlans,
  type Area,
  type Plan,
  type Scenario,
} from "./planning-data";
import { areaCodeFor, planFromApi, planWriteInput } from "./saved-plan-adapter";
import {
  BriefPanel,
  DateComparison,
  Seasonality,
  AreaOverview,
  SiteCard,
} from "./planning-panels";
import styles from "./planning.module.css";

type RefreshedAssessment = {
  planId: string;
  date: string;
  source: string;
  retrievedAt: string;
  day: PlanningDay | null;
  sites: PlanningSite[];
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      onCancel={onClose}
      aria-label={title}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close dialog"
      >
        <X size={22} />
      </button>
      {children}
    </dialog>
  );
}

export function DivePlanner() {
  const params = useSearchParams();
  const router = useRouter();
  const previewMode = params.get("preview") === "1";
  const { user, status } = useAuth();
  const incomingSite = reefSites.find((site) => site.id === params.get("site"));
  const initialArea =
    incomingSite?.island ??
    (areas.includes(params.get("area") as Area)
      ? (params.get("area") as Area)
      : "Perhentian");
  const [today] = useState(() => localToday());
  const initialDate = validDate(params.get("date") ?? "")
    ? params.get("date")!
    : addDays(today, 1);
  const [area, setArea] = useState<Area>(initialArea);
  const [from, setFrom] = useState(initialDate);
  const [to, setTo] = useState(addDays(initialDate, 4));
  const [dates, setDates] = useState(() =>
    dateRange(initialDate, addDays(initialDate, 4)),
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedSites, setSelectedSites] = useState<string[]>(
    params
      .getAll("sites")
      .filter((id) => sitesIn(initialArea).some((site) => site.id === id))
      .length
      ? params
          .getAll("sites")
          .filter((id) => sitesIn(initialArea).some((site) => site.id === id))
      : incomingSite
        ? [incomingSite.id]
        : [],
  );
  const [tab, setTab] = useState<"planner" | "season" | "plans">("planner");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [showTools, setShowTools] = useState(false);
  const [briefSite, setBriefSite] = useState<string | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [demoOwner, setDemoOwner] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planName, setPlanName] = useState("");
  const [saveDialog, setSaveDialog] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [pastPlan, setPastPlan] = useState<Plan | null>(null);
  const [reportSite, setReportSite] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [confirmedDive, setConfirmedDive] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [refreshedAssessment, setRefreshedAssessment] =
    useState<RefreshedAssessment | null>(null);
  const authenticatedObserver =
    status === "authenticated" && user?.role === "observer";
  const owner =
    authenticatedObserver
      ? `user-${user.id}`
      : status === "unauthenticated" && previewMode
        ? demoOwner
        : null;
  const isDemo = Boolean(owner?.startsWith("demo-"));
  const sites = sitesIn(area);
  const activeBriefSite = sites.find((site) => site.id === briefSite);
  const selectedProfiles = sites.filter((site) =>
    selectedSites.includes(site.id),
  );
  const returnPath = `/plan-a-dive?area=${area}&date=${selectedDate}${selectedSites[0] ? `&site=${selectedSites[0]}${selectedSites.map((id) => `&sites=${id}`).join("")}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;

  useEffect(() => {
    let storedDemo: string | null = null;
    try {
      storedDemo = previewMode
        ? sessionStorage.getItem("reefcare-planner-demo")
        : null;
    } catch {
      /* Browsing still works without storage. */
    }
    queueMicrotask(() => setDemoOwner(storedDemo));
  }, [previewMode]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setStorageReady(false));
    async function loadSavedPlans() {
      try {
        const next = authenticatedObserver
          ? (await listPlans()).items.map(planFromApi)
          : owner
            ? readPlans(owner)
            : [];
        if (!cancelled) setPlans(next);
      } catch (loadError) {
        if (!cancelled) {
          setPlans([]);
          setError(
            userFacingError(
              loadError,
              "Your saved dive plans could not be loaded. Please try again.",
            ),
          );
        }
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    }
    void loadSavedPlans();
    return () => {
      cancelled = true;
    };
  }, [authenticatedObserver, owner]);

  function switchArea(value: Area) {
    setArea(value);
    setSelectedSites([]);
    setEditing(null);
    setBriefSite(null);
    setMessage("");
    setError("");
    setRefreshError("");
    setRefreshedAssessment(null);
  }
  function compare(event: React.FormEvent) {
    event.preventDefault();
    const nextDates = dateRange(from, to);
    if (!nextDates.length) {
      setError(
        "Choose an end date on or after the start date, within a 14-day window.",
      );
      return;
    }
    setDates(nextDates);
    setSelectedDate(from);
    setError("");
    setMessage("Date comparison updated.");
    setTab("planner");
  }
  function toggleSite(id: string) {
    setSelectedSites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    setError("");
  }
  function requestSave() {
    setError("");
    setMessage("");
    if (!selectedProfiles.length) {
      setError("Add at least one dive site to your plan using the + button.");
      return;
    }
    if (status === "loading") {
      setError("Your account is still loading. Please try again shortly.");
      return;
    }
    if (status === "authenticated" && user?.role !== "observer") {
      setError("Private dive plans are available to Observer accounts.");
      return;
    }
    if (!owner) {
      setAuthPrompt(true);
      return;
    }
    setPlanName(
      editing
        ? (plans.find((plan) => plan.planId === editing)?.name ??
            `${area} dive plan`)
        : `${area} dive plan`,
    );
    setSaveDialog(true);
  }
  function enterDemo() {
    try {
      const id = demoOwner ?? `demo-${crypto.randomUUID()}`;
      sessionStorage.setItem("reefcare-planner-demo", id);
      if (!readPlans(id).length) writePlans(id, [pastExample(today)]);
      setStorageReady(false);
      setDemoOwner(id);
      setAuthPrompt(false);
      setMessage(
        "Demo workspace opened. Plans stay in this browser; you are not signed into ReefCare.",
      );
    } catch {
      setError(
        "Browser storage is unavailable. Allow local storage to try saved plans.",
      );
    }
  }
  function persistDemo(next: Plan[]): boolean {
    if (!owner || !isDemo) return false;
    try {
      writePlans(owner, next);
      setPlans(next);
      return true;
    } catch {
      setError(
        "Your plan could not be stored on this device. Please check browser storage and try again.",
      );
      return false;
    }
  }
  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!planName.trim() || !owner || !storageReady) return;
    setPlanBusy(true);
    setError("");
    try {
      let plan: Plan;
      if (isDemo) {
        plan = {
          planId: editing ?? crypto.randomUUID(),
          name: planName.trim(),
          area,
          plannedDate: selectedDate,
          siteIds: selectedSites,
          updatedAt: new Date().toISOString(),
        };
        if (!persistDemo([plan, ...plans.filter((item) => item.planId !== plan.planId)])) return;
      } else {
        const body = planWriteInput(planName, area, selectedDate, selectedSites);
        const response = editing
          ? await updatePlan(Number(editing), body)
          : await createPlan(body);
        plan = planFromApi(response);
        setPlans((current) => [
          plan,
          ...current.filter((item) => item.planId !== plan.planId),
        ]);
      }
      setSaveDialog(false);
      setEditing(null);
      setMessage(
        isDemo
          ? `“${plan.name}” saved in this demo browser.`
          : `“${plan.name}” saved to your ReefCare account.`,
      );
      setTab("plans");
    } catch (saveError) {
      setError(
        userFacingError(
          saveError,
          "Your dive plan could not be saved. Check the details and try again.",
        ),
      );
    } finally {
      setPlanBusy(false);
    }
  }
  async function openPlan(plan: Plan, edit = false) {
    setError("");
    setMessage("");
    setRefreshError("");
    setRefreshedAssessment(null);
    setPlanBusy(true);
    try {
      const loaded = isDemo ? plan : planFromApi(await getPlan(Number(plan.planId)));
      if (loaded.plannedDate < today && !edit) {
        setPastPlan(loaded);
        setReportSite(loaded.siteIds[0]);
        setReportDate(loaded.plannedDate);
        setConfirmedDive(false);
        return;
      }
      setArea(loaded.area);
      setSelectedDate(loaded.plannedDate);
      setFrom(loaded.plannedDate);
      setTo(addDays(loaded.plannedDate, 4));
      setDates(dateRange(loaded.plannedDate, addDays(loaded.plannedDate, 4)));
      setSelectedSites(loaded.siteIds);
      setEditing(loaded.planId);
      setTab("planner");

      if (isDemo) {
        setMessage(
          "Demo plan loaded. Sample conditions are recalculated and were not stored with the plan.",
        );
        return;
      }
      try {
        const code = areaCodeFor(loaded.area);
        const [dateResult, siteResult] = await Promise.all([
          getPlanningDates(code, loaded.plannedDate, loaded.plannedDate),
          getPlanningSites(code, loaded.plannedDate),
        ]);
        const selectedBackendIds = new Set(
          loaded.siteIds
            .map((id) => reefSites.find((site) => site.id === id)?.backendDiveSiteId)
            .filter((id): id is number => typeof id === "number"),
        );
        setRefreshedAssessment({
          planId: loaded.planId,
          date: loaded.plannedDate,
          source: siteResult.source || dateResult.source,
          retrievedAt: siteResult.retrievedAt || dateResult.retrievedAt,
          day: dateResult.days.find((day) => day.date === loaded.plannedDate) ?? null,
          sites: siteResult.sites.filter((site) => selectedBackendIds.has(site.diveSiteId)),
        });
        setMessage(
          "Saved planning intent loaded. The conditions below were requested again and are not stored forecast values.",
        );
      } catch (assessmentError) {
        setRefreshError(
          userFacingError(
            assessmentError,
            "The saved plan is available, but current conditions could not be refreshed. Try again later.",
          ),
        );
      }
    } catch (openError) {
      setError(
        userFacingError(openError, "This saved dive plan could not be opened."),
      );
    } finally {
      setPlanBusy(false);
    }
  }

  async function removePlan(plan: Plan) {
    setPlanBusy(true);
    setError("");
    try {
      if (isDemo) {
        if (!persistDemo(plans.filter((item) => item.planId !== plan.planId))) return;
      } else {
        await deletePlan(Number(plan.planId));
        setPlans((current) => current.filter((item) => item.planId !== plan.planId));
      }
      setDeleting(null);
      setMessage("Plan deleted.");
    } catch (deleteError) {
      setError(userFacingError(deleteError, "This dive plan could not be deleted."));
    } finally {
      setPlanBusy(false);
    }
  }
  function startReport() {
    const site = reefSites.find((item) => item.id === reportSite);
    if (
      !site ||
      !confirmedDive ||
      !validDate(reportDate) ||
      reportDate > today
    ) {
      setError(
        "Confirm the site and a date no later than today before continuing.",
      );
      return;
    }
    try {
      storeSelectedReefSite(site);
    } catch {
      setError(
        "Cannot preserve the selected site. Please enable browser storage and retry.",
      );
      return;
    }
    const destination = `/report-a-reef?source=planning&plannedDate=${reportDate}`;
    router.push(
      status === "authenticated" && user?.role === "observer"
        ? destination
        : `/login?next=${encodeURIComponent(destination)}`,
    );
  }
  function exitDemo() {
    try {
      sessionStorage.removeItem("reefcare-planner-demo");
    } catch {}
    setDemoOwner(null);
    setPlans([]);
    setStorageReady(false);
    setMessage("Demo workspace closed.");
  }

  return (
    <div className={styles.page}>
      {previewMode && (
        <>
          <div className={styles.demoBar}>
            <span>
              <FlaskConical size={15} />
              <strong>Interactive prototype</strong>
              <span className={styles.demoDescription}>
                Sample forecasts, seasonal guidance & reef activity
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              aria-expanded={showTools}
            >
              <SlidersHorizontal size={15} /> Demo settings
            </button>
          </div>
          {showTools && (
            <div className={styles.tools}>
              <label>
                Preview a service state
                <select
                  value={scenario}
                  onChange={(event) =>
                    setScenario(event.target.value as Scenario)
                  }
                >
                  <option value="normal">All sample data available</option>
                  <option value="provider">
                    Forecast provider unavailable
                  </option>
                  <option value="ai">AI briefing unavailable</option>
                  <option value="context">No public ReefCare context</option>
                  <option value="position">
                    First site position unavailable
                  </option>
                </select>
              </label>
              <p>
                Demonstration controls only. No live data or AI is connected.
                Saved plans use this browser’s storage, not the backend.
              </p>
              {demoOwner ? (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={exitDemo}
                >
                  Exit demo workspace
                </button>
              ) : (
                status === "unauthenticated" && (
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={enterDemo}
                  >
                    Open demo workspace
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/explore">Explore reefs</Link>
          <ChevronRight size={13} />
          <span>Plan a dive</span>
        </div>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>REEF-AWARE DIVE PLANNING</span>
            <h1
              tabIndex={-1}
              style={{ outline: "none", outlineOffset: 0, boxShadow: "none" }}
            >
              A little planning.
              <br />A deeper connection.
            </h1>
            <p>
              Find your window, get to know the reef, and arrive with a little
              more awareness.
            </p>
            <div className={styles.heroMeta}>
              <span>
                <Compass size={17} />3 Malaysian reef areas
              </span>
              <span>
                <Waves size={18} />
                Conditions with context
              </span>
            </div>
          </div>
          <div className={styles.heroImage}>
            <Image
              src="/images/reef-sites/surface/redang.jpg"
              alt="Turquoise water, white sand and palm trees along the coast of Redang Island"
              fill
              priority
              sizes="(max-width: 700px) 100vw, 45vw"
            />
            <span>
              Discover with care.
              <small>
                Redang Island · <a href="https://commons.wikimedia.org/wiki/File:Redang_Sea_Beach.jpg" target="_blank" rel="noreferrer">Mukherjeesaikat</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> · Cropped
              </small>
            </span>
          </div>
        </section>
        <div className={styles.tabs} aria-label="Planning sections">
          {(
            [
              { key: "planner", label: "Plan your dive", icon: Compass },
              { key: "season", label: "Seasonal calendar", icon: CalendarDays },
              { key: "plans", label: "My dive plans", icon: Bookmark },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setError("");
              }}
            >
              <item.icon size={17} />
              {item.label}
              {item.key === "plans" && owner && plans.length > 0 && (
                <span className={styles.count}>{plans.length}</span>
              )}
            </button>
          ))}
          <span className={styles.tabNote}>
            {owner
              ? owner.startsWith("demo-")
                ? "Demo workspace · this device"
                : "Your dive plans"
              : "Explore freely. No account needed."}
          </span>
        </div>
        {message && (
          <div className={styles.success} role="status">
            <Check size={17} />
            {message}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {tab === "planner" && refreshError && (
          <div className={styles.refreshWarning} role="status">
            <Info size={18} />
            <div>
              <strong>Saved plan loaded without a refreshed assessment</strong>
              <p>{refreshError}</p>
            </div>
          </div>
        )}
        {tab === "planner" && refreshedAssessment && (
          <section className={styles.refreshedAssessment} aria-labelledby="refreshed-assessment-heading">
            <div>
              <span className={styles.eyebrow}>LIVE REFRESH · NOT SAVED WITH THE PLAN</span>
              <h2 id="refreshed-assessment-heading">Refreshed conditions</h2>
              <p>
                Current planning data for {dateLabel(refreshedAssessment.date, true)} was requested
                again after opening this saved intent.
              </p>
            </div>
            {refreshedAssessment.day && (
              <div className={styles.refreshSummary}>
                <strong>{labels[refreshedAssessment.day.band]}</strong>
                <span>
                  {refreshedAssessment.day.assessableSites} of {refreshedAssessment.day.totalSites}{" "}
                  sites assessable
                </span>
              </div>
            )}
            <div className={styles.refreshSites}>
              {refreshedAssessment.sites.map((site) => (
                <article key={site.diveSiteId}>
                  <strong>{site.siteName}</strong>
                  <span>{labels[site.band]}</span>
                  <small>{site.reason}</small>
                </article>
              ))}
              {!refreshedAssessment.sites.length && (
                <p>No current site assessment was returned for the sites in this plan.</p>
              )}
            </div>
            <small className={styles.source}>
              Source: {refreshedAssessment.source} · Retrieved {refreshedAssessment.retrievedAt}
            </small>
          </section>
        )}
        {tab !== "plans" && (
          <form className={styles.search} onSubmit={compare}>
            <label>
              <span>
                <MapPin size={15} /> Reef area
              </span>
              <select
                value={area}
                onChange={(event) => switchArea(event.target.value as Area)}
              >
                {areas.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {tab === "planner" && (
              <>
                <label>
                  <span>From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    required
                  />
                </label>
                <button className={styles.primary} type="submit">
                  Compare dates <ArrowRight size={18} />
                </button>
              </>
            )}
            <p className={styles.searchHint}>
              {tab === "planner"
                ? `Sample forecast: ${dateLabel(today)} – ${dateLabel(addDays(today, 6))}. Dates outside this range show seasonal context only.`
                : "Curated seasonal reference · separate from date-specific forecasts"}
            </p>
          </form>
        )}
        {tab === "season" && <Seasonality area={area} />}
        {tab === "planner" && (
          <>
            <DateComparison
              dates={dates}
              area={area}
              today={today}
              scenario={scenario}
              selected={selectedDate}
              onSelect={setSelectedDate}
            />
            <div className={styles.contentGrid}>
              <section aria-labelledby="sites-heading">
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.eyebrow}>
                      02 / GET TO KNOW YOUR OPTIONS
                    </span>
                    <h2 id="sites-heading">A closer look at {area}</h2>
                    <p>
                      {dateLabel(selectedDate, true)} · {sites.length} supported
                      dive sites
                    </p>
                  </div>
                </div>
                {(selectedDate < today || selectedDate > addDays(today, 6)) && (
                  <div className={styles.seasonDetail}>
                    <Info size={20} />
                    <div>
                      <strong>No current forecast for this date</strong>
                      <p>
                        Keep planning with site information and seasonal
                        reference.
                      </p>
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => setTab("season")}
                      >
                        View seasonal calendar <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
                <AreaOverview area={area} />
                <div id="site-results" className={styles.siteGrid}>
                  {sites.map((site, index) => (
                    <SiteCard
                      date={selectedDate}
                      key={site.id}
                      site={site}
                      assessment={assess(
                        selectedDate,
                        area,
                        today,
                        scenario,
                        index,
                      )}
                      selected={selectedSites.includes(site.id)}
                      onToggle={() => toggleSite(site.id)}
                      onBrief={() => setBriefSite(site.id)}
                    />
                  ))}
                </div>
              </section>
              <aside className={styles.sidebar}>
                <div className={styles.planSummary}>
                  <span className={styles.eyebrow}>YOUR DIVE PLAN</span>
                  <h2>{area}</h2>
                  <p>
                    <CalendarDays size={16} />
                    {dateLabel(selectedDate, true)}
                  </p>
                  <div className={styles.selectedList}>
                    {selectedProfiles.length ? (
                      selectedProfiles.map((site) => (
                        <div key={site.id}>
                          <span>
                            <Check size={15} />
                            {site.name}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${site.name}`}
                            onClick={() => toggleSite(site.id)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className={styles.emptySelection}>
                        <Plus size={24} />
                        <p>
                          Add the sites you would like to explore using the + on
                          each card.
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={requestSave}
                    disabled={!selectedProfiles.length || !storageReady || planBusy}
                  >
                    <Bookmark size={17} />
                    {editing ? "Update plan" : "Save dive plan"}
                  </button>
                  <small>
                    {owner
                      ? isDemo
                        ? "Demo plans stay in this browser."
                        : "Saved privately to your Observer account."
                      : "Sign in to save your dive plan."}
                  </small>
                </div>
                <div className={styles.careNote}>
                  <div className={styles.careIcon}>
                    <Waves size={24} />
                  </div>
                  <h3>A forecast is a starting point.</h3>
                  <p>
                    Conditions can change. Speak to a local dive operator about
                    current conditions, access and your experience.
                  </p>
                  <Link href="/reef-threats">
                    Dive with reef awareness <ArrowRight size={16} />
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
        {tab === "plans" && (
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>
                  KEEP YOUR NEXT ADVENTURE CLOSE
                </span>
                <h2>My dive plans</h2>
                <p>
                  Revisit your ideas. Refresh your conditions. Record what you
                  observed.
                </p>
              </div>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setEditing(null);
                  setSelectedSites([]);
                  setTab("planner");
                }}
              >
                <Plus size={17} /> New plan
              </button>
            </div>
            {!owner ? (
              <div className={styles.emptyState}>
                <Bookmark size={36} />
                <h3>Your plans, ready when you are.</h3>
                <p>
                  Sign in as an Observer to save and revisit your dive plans.
                </p>
                <Link className={styles.primary} href={loginHref}>
                  Log in
                </Link>
                {previewMode && status === "unauthenticated" && (
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={enterDemo}
                  >
                    Try demo workspace
                  </button>
                )}
              </div>
            ) : !storageReady ? (
              <p role="status">Loading your plans…</p>
            ) : !plans.length ? (
              <div className={styles.emptyState}>
                <Compass size={36} />
                <h3>A new plan starts with a place.</h3>
                <p>You haven’t saved any dive plans yet.</p>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={() => setTab("planner")}
                >
                  Explore dive sites <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <div className={styles.savedList}>
                {plans.map((plan) => (
                  <article key={plan.planId} className={styles.savedPlan}>
                    <div className={styles.savedIcon}>
                      <CalendarDays size={26} />
                    </div>
                    <div>
                      <span className={styles.smallTag}>
                        {plan.plannedDate < today
                          ? "Past plan"
                          : "Upcoming plan"}
                        {plan.planId === "example-past"
                          ? " · Demo example"
                          : ""}
                      </span>
                      <h3>{plan.name}</h3>
                      <p>
                        {plan.area} · {dateLabel(plan.plannedDate, true)} ·{" "}
                        {plan.siteIds.length}{" "}
                        {plan.siteIds.length === 1 ? "site" : "sites"}
                      </p>
                      <small>
                        {plan.plannedDate < today
                          ? "Past planning intent, not proof a dive occurred. No current forecast shown."
                          : "Current sample conditions refresh when you reopen this plan."}
                      </small>
                    </div>
                    <div className={styles.planActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => openPlan(plan)}
                        disabled={planBusy}
                      >
                        {plan.plannedDate < today
                          ? "View past plan"
                          : "Open plan"}
                        <ArrowRight size={16} />
                      </button>
                      <button
                        type="button"
                        className={styles.textButton}
                        onClick={() => openPlan(plan, true)}
                        disabled={planBusy}
                      >
                        Edit plan
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Delete ${plan.name}`}
                        onClick={() => setDeleting(plan)}
                        disabled={planBusy}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className={styles.source}>
              {isDemo
                ? "Demo plans are saved only in this browser and are not synced."
                : "Plans contain planning intent only. Forecasts and assessments are refreshed when a plan is opened."}
            </p>
          </section>
        )}
        <div className={styles.bottomNote}>
          <Info size={17} />
          <p>
            ReefCare helps you understand conditions and reef context. It does
            not provide dive clearance or replace local operator and authority
            guidance.
          </p>
        </div>
      </div>
      {activeBriefSite && (
        <Modal
          title="Reef-aware planning brief"
          onClose={() => setBriefSite(null)}
        >
          <BriefPanel
            key={`${activeBriefSite.id}-${selectedDate}-${scenario}`}
            site={activeBriefSite}
            date={selectedDate}
            area={area}
            today={today}
            scenario={scenario}
          />
        </Modal>
      )}
      {authPrompt && (
        <Modal title="Save your dive plan" onClose={() => setAuthPrompt(false)}>
          <div className={styles.dialogContent}>
            <Bookmark size={32} />
            <h2>Keep this plan for later</h2>
            <p>
              Sign in or create an Observer account to continue. Your selected
              site and date will travel with you.
            </p>
            <div className={styles.dialogActions}>
              <Link className={styles.primary} href={loginHref}>
                Log in
              </Link>
              <Link
                className={styles.secondary}
                href={`/register?next=${encodeURIComponent(returnPath)}`}
              >
                Create account
              </Link>
            </div>
            {previewMode && (
              <>
                <hr />
                <h3>Just exploring the prototype?</h3>
                <p>
                  Try a local demo workspace. It includes a past plan so you can
                  preview the reporting handoff. No real account or report is
                  created.
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={enterDemo}
                >
                  Continue in demo workspace <ArrowRight size={17} />
                </button>
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {saveDialog && (
        <Modal title="Name your dive plan" onClose={() => setSaveDialog(false)}>
          <form className={styles.dialogContent} onSubmit={savePlan}>
            <span className={styles.eyebrow}>SAVE YOUR INTENTION</span>
            <h2>
              {editing ? "Update your plan" : "Make it your next adventure"}
            </h2>
            <label>
              Plan name
              <input
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                required
                maxLength={80}
                autoFocus
              />
            </label>
            <p>
              {area} · {dateLabel(selectedDate, true)} · {selectedSites.length}{" "}
              selected sites
            </p>
            <p>
              We save your area, date and sites. Forecast values are refreshed
              when you revisit.
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              className={styles.primary}
              type="submit"
              disabled={!planName.trim()}
            >
              {planBusy ? "Saving…" : "Save plan"}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Delete dive plan" onClose={() => setDeleting(null)}>
          <div className={styles.dialogContent}>
            <h2>Delete “{deleting.name}”?</h2>
            <p>
              {isDemo
                ? "This removes the demo plan from this browser."
                : "This permanently removes the plan from your ReefCare account."}
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setDeleting(null)}
              >
                Keep plan
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={planBusy}
                onClick={() => void removePlan(deleting)}
              >
                {planBusy ? "Deleting…" : "Delete plan"}
              </button>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {pastPlan && (
        <Modal
          title="Past dive plan and report handoff"
          onClose={() => setPastPlan(null)}
        >
          <div className={styles.dialogContent}>
            <span className={styles.eyebrow}>
              PAST PLAN · NO CURRENT FORECAST
            </span>
            <h2>{pastPlan.name}</h2>
            <p>
              {dateLabel(pastPlan.plannedDate, true)} · {pastPlan.area}
            </p>
            <h3>Did you observe something?</h3>
            <p>
              Start the normal reef report with editable suggestions from your
              plan. A saved plan does not prove that a dive took place.
            </p>
            <label>
              Observed site
              <select
                value={reportSite}
                onChange={(event) => setReportSite(event.target.value)}
              >
                {sitesIn(pastPlan.area).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Actual observation date
              <input
                type="date"
                max={today}
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={confirmedDive}
                onChange={(event) => setConfirmedDive(event.target.checked)}
              />
              I have checked the suggested site and date against my actual
              observation.
            </label>
            <p className={styles.source}>
              Reporting requires a real Observer account. Your Dive Session,
              location and evidence still need confirmation in the existing
              report flow.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <button
              className={styles.primary}
              type="button"
              disabled={!confirmedDive}
              onClick={startReport}
            >
              Report an observation <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

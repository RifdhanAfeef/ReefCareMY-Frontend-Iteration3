"use client";
import Link from "next/link";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
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
import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";
import {
  addDays,
  areas,
  dateLabel,
  dateRange,
  localToday,
  pastExample,
  readPlans,
  sitesIn,
  validDate,
  writePlans,
  type Area,
  type Assessment,
  type Plan,
  type Scenario,
} from "./planning-data";
import {
  BriefPanel,
  DateComparison,
  LoadError,
  Seasonality,
  AreaOverview,
  SiteCard,
} from "./planning-panels";
import {
  FORECAST_HORIZON_DAYS,
  getPlanningSource,
  unavailableAssessment,
} from "./planning-source";
import styles from "./planning.module.css";
import { useAsyncData } from "./use-async-data";

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
  const [openedPlan, setOpenedPlan] = useState<Plan | null>(null);
  const owner =
    status === "authenticated" && user?.role === "observer"
      ? `user-${user.id}`
      : status === "unauthenticated" && previewMode
        ? demoOwner
        : null;
  const sites = sitesIn(area);
  const source = getPlanningSource(previewMode);
  const sample = source.mode === "sample";
  const planningContext = useMemo(
    () => ({ today, scenario }),
    [today, scenario],
  );
  const { state: summaries, retry: retrySummaries } = useAsyncData(
    () => source.dateSummaries(area, dates, planningContext),
    [source, area, dates, planningContext],
  );
  const { state: siteState, retry: retrySites } = useAsyncData(
    () => source.siteAssessments(area, selectedDate, planningContext),
    [source, area, selectedDate, planningContext],
  );
  function assessmentFor(siteId: string): Assessment | null {
    if (siteState.status === "loading") return null;
    if (siteState.status === "error")
      return unavailableAssessment("Conditions could not be loaded for this site.");
    return (
      siteState.data[siteId] ??
      unavailableAssessment("No assessment is available for this site.")
    );
  }
  const siteAssessments =
    siteState.status === "ready" ? Object.values(siteState.data) : [];
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
    let current = true;
    queueMicrotask(async () => {
      if (!current) return;
      if (!owner) {
        setPlans([]);
        setStorageReady(true);
        return;
      }
      setStorageReady(false);
      try {
        const loaded = await source.listPlans(owner);
        if (!current) return;
        setPlans(loaded);
      } catch (loadError) {
        if (!current) return;
        setPlans([]);
        setError(userFacingError(loadError, "Your dive plans could not be loaded."));
      }
      setStorageReady(true);
    });
    return () => {
      current = false;
    };
  }, [owner, source]);

  function switchArea(value: Area) {
    setArea(value);
    setOpenedPlan(null);
    setSelectedSites([]);
    setEditing(null);
    setBriefSite(null);
    setMessage("");
    setError("");
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
  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!planName.trim() || !owner || !storageReady || planBusy) return;
    const plan: Plan = {
      planId: editing ?? crypto.randomUUID(),
      name: planName.trim(),
      area,
      plannedDate: selectedDate,
      siteIds: selectedSites,
      updatedAt: new Date().toISOString(),
    };
    setPlanBusy(true);
    try {
      const saved = await source.savePlan(owner, plan, editing !== null);
      setPlans((current) => [
        saved,
        ...current.filter(
          (item) => item.planId !== plan.planId && item.planId !== saved.planId,
        ),
      ]);
      setSaveDialog(false);
      setEditing(null);
      setOpenedPlan(null);
      setError("");
      setMessage(
        `“${saved.name}” saved ${sample ? "on this device" : "to your account"}.`,
      );
      setTab("plans");
    } catch (saveError) {
      setError(
        userFacingError(
          saveError,
          sample
            ? "Your plan could not be stored on this device. Please check browser storage and try again."
            : "Your plan could not be saved. Please try again.",
        ),
      );
    } finally {
      setPlanBusy(false);
    }
  }
  async function confirmDelete() {
    if (!deleting || !owner || planBusy) return;
    setPlanBusy(true);
    try {
      await source.deletePlan(owner, deleting.planId);
      setPlans((current) =>
        current.filter((plan) => plan.planId !== deleting.planId),
      );
      setDeleting(null);
      setError("");
      setMessage("Plan deleted.");
    } catch (deleteError) {
      setError(
        userFacingError(
          deleteError,
          sample
            ? "Your plan could not be removed from this device. Please try again."
            : "Your plan could not be deleted. Please try again.",
        ),
      );
    } finally {
      setPlanBusy(false);
    }
  }
  async function openPlan(plan: Plan, edit = false) {
    if (!owner || planBusy) return;
    setError("");
    setMessage("");
    setPlanBusy(true);
    let loaded: Plan;
    try {
      // Reload the saved intent so a plan edited or deleted elsewhere is not shown stale.
      loaded = await source.loadPlan(owner, plan);
    } catch (openError) {
      if (openError instanceof ApiError && openError.status === 404) {
        setPlans((current) => current.filter((item) => item.planId !== plan.planId));
        setError("This dive plan no longer exists. It has been removed from your list.");
      } else {
        setError(userFacingError(openError, "This saved dive plan could not be opened. Please try again."));
      }
      return;
    } finally {
      setPlanBusy(false);
    }
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
    setOpenedPlan(loaded);
    setTab("planner");
    // Area and date may be unchanged, which would keep the earlier site forecast; always request it again.
    retrySites();
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
        <header className={styles.hero}>
          <h1
            tabIndex={-1}
            style={{ outline: "none", outlineOffset: 0, boxShadow: "none" }}
          >
            Plan a dive
          </h1>
          <p>
            Compare forecast conditions, pick your sites and get a reef-aware
            brief before you go.
          </p>
        </header>
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
        {tab === "planner" && openedPlan && (
          <section className={styles.savedIntent} aria-labelledby="saved-intent-heading">
            <Bookmark size={18} />
            <div>
              <h2 id="saved-intent-heading">{openedPlan.name}</h2>
              <p>
                {openedPlan.area} · {dateLabel(openedPlan.plannedDate, true)} ·{" "}
                {openedPlan.siteIds.length} selected{" "}
                {openedPlan.siteIds.length === 1 ? "site" : "sites"} · planning
                intent only
              </p>
              <p>
                {sample
                  ? "Conditions below are recalculated from the current sample dataset. No forecast was stored with this plan."
                  : "Conditions below were requested again just now. No forecast was stored with this plan."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss saved plan summary"
              onClick={() => setOpenedPlan(null)}
            >
              <X size={16} />
            </button>
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
                  <DisplayDateInput
                    label="From"
                    valueFormat="iso"
                    value={from}
                    onChange={setFrom}
                    required
                    allowFuture
                  />
                </label>
                <label>
                  <span>To</span>
                  <DisplayDateInput
                    label="To"
                    valueFormat="iso"
                    value={to}
                    onChange={setTo}
                    required
                    allowFuture
                  />
                </label>
                <button className={styles.primary} type="submit">
                  Compare dates <ArrowRight size={18} />
                </button>
              </>
            )}
            <p className={styles.searchHint}>
              {tab === "planner"
                ? `${sample ? "Sample forecast" : "Forecast"}: ${dateLabel(today)} – ${dateLabel(addDays(today, FORECAST_HORIZON_DAYS))}. Dates outside this range show seasonal context only.`
                : "Curated seasonal reference · separate from date-specific forecasts"}
            </p>
          </form>
        )}
        {tab === "season" && (
          <Seasonality area={area} source={source} today={today} />
        )}
        {tab === "planner" && (
          <>
            <DateComparison
              dates={dates}
              summaries={summaries}
              onRetry={retrySummaries}
              siteAssessments={siteAssessments}
              sitesLoading={siteState.status === "loading"}
              total={sites.length}
              selected={selectedDate}
              onSelect={setSelectedDate}
              mode={source.mode}
            />
            <div className={styles.contentGrid}>
              <section aria-labelledby="sites-heading">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="sites-heading">Dive sites in {area}</h2>
                    <p>
                      {dateLabel(selectedDate, true)} · {sites.length} sites
                    </p>
                  </div>
                </div>
                {(selectedDate < today ||
                  selectedDate > addDays(today, FORECAST_HORIZON_DAYS)) && (
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
                {siteState.status === "error" && (
                  <LoadError
                    error={siteState.error}
                    fallback="Site conditions could not be loaded."
                    onRetry={retrySites}
                  />
                )}
                <div id="site-results" className={styles.siteGrid}>
                  {sites.map((site) => (
                    <SiteCard
                      date={selectedDate}
                      key={site.id}
                      site={site}
                      mode={source.mode}
                      assessment={assessmentFor(site.id)}
                      selected={selectedSites.includes(site.id)}
                      onToggle={() => toggleSite(site.id)}
                      onBrief={() => setBriefSite(site.id)}
                    />
                  ))}
                </div>
              </section>
              <aside className={styles.sidebar}>
                <div className={styles.planSummary}>
                  <h2>Your dive plan</h2>
                  <p>
                    <CalendarDays size={16} />
                    {area} · {dateLabel(selectedDate, true)}
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
                        <p>Tap + on a site to add it.</p>
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
                      ? sample
                        ? "Saved on this device."
                        : "Saved privately to your Observer account."
                      : "Sign in to save."}
                  </small>
                </div>
                <div className={styles.careNote}>
                  <div className={styles.careIcon}>
                    <Waves size={24} />
                  </div>
                  <h3>A forecast is a starting point</h3>
                  <p>
                    Conditions change. Check with a local dive operator before
                    you go.
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
                <h2>My dive plans</h2>
                <p>Revisit a plan or report what you saw.</p>
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
                          : sample
                            ? "Current sample conditions refresh when you reopen this plan."
                            : "Current conditions refresh when you reopen this plan."}
                      </small>
                    </div>
                    <div className={styles.planActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => void openPlan(plan)}
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
                        onClick={() => void openPlan(plan, true)}
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
              {sample
                ? "Plans are saved only on this device. They are not synced across devices."
                : "Plans contain planning intent only. Forecasts and assessments are refreshed when a plan is opened."}
            </p>
          </section>
        )}
        <div className={styles.bottomNote}>
          <Info size={17} />
          <p>
            ReefCare is a planning aid, not dive clearance. Local operator and
            authority guidance always comes first.
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
            assessment={assessmentFor(activeBriefSite.id)}
            source={source}
            context={planningContext}
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
              selected {selectedSites.length === 1 ? "site" : "sites"}
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
              disabled={!planName.trim() || planBusy}
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
              {sample
                ? "This removes the saved plan from this device."
                : "This permanently removes the saved plan from your account."}
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
                onClick={confirmDelete}
                disabled={planBusy}
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
            <h2>{pastPlan.name}</h2>
            <p>
              {dateLabel(pastPlan.plannedDate, true)} · {pastPlan.area} · past
              plan, no current forecast
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
              <DisplayDateInput
                label="Actual observation date"
                valueFormat="iso"
                maxDate={today}
                value={reportDate}
                onChange={setReportDate}
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

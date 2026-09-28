"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DisplayDateInput } from "@/components/forms/display-date-input";
import { BackButton } from "@/components/navigation/back-button";
import type { LocationConfidenceCode } from "@/features/epic-01-access/types";
import { useMockAppState, type DiveSession, type MapPin } from "@/features/shared/mock-app-state";
import { createDiveSession, getDiveSessions } from "@/lib/api/diveSessionsApi";
import { getDiveSites } from "@/lib/api/referenceApi";
import { checkReportLocation } from "@/lib/api/reportsApi";
import type { DiveSiteReference } from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { clearSelectedReefSite, readSelectedReefSite } from "@/features/epic-02-reef-explorer/selected-site-storage";
import { reefSites } from "@/features/epic-02-reef-explorer/reef-sites";
import { buildLocationCheckPayload } from "@/features/epic-02-reporting/report-payload";
import { displayDateAndTimeToIso, displayDateToIsoDate, inputDateToDisplayValue, isFutureDisplayDate, isValidDisplayDate } from "@/lib/format/date";
import styles from "./location-flow.module.css";

const confidenceOptions: Array<{ value: LocationConfidenceCode; label: string }> = [
  { value: "exact", label: "Exact" },
  { value: "within_100m", label: "Within approximately 100 m" },
  { value: "within_1km", label: "Within approximately 1 km" },
  { value: "dive_site_only", label: "Dive-site only" },
  { value: "unsure", label: "Unsure" },
];

const malaysiaBounds = {
  west: 99.2,
  east: 119.6,
  south: 0.5,
  north: 7.7,
};
const diveSiteRadiusMetres = 5000;
const islandRadiusMetres = 15000;

const MalaysiaMap = dynamic(
  () => import("./malaysia-map").then((module) => module.MalaysiaMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Loading map…</div>,
  },
);

type ProgressStep = "session" | "location" | "confirm" | "privacy" | "review";

const progressSteps: Array<{ value: ProgressStep; label: string }> = [
  { value: "session", label: "Dive Session" },
  { value: "location", label: "Location" },
  { value: "confirm", label: "Accuracy" },
  { value: "privacy", label: "Privacy" },
  { value: "review", label: "Location saved" },
];

function PageHeading({ eyebrow, title, description, currentStep, furthestStep, onNavigate }: { eyebrow: string; title: string; description: string; currentStep: ProgressStep; furthestStep?: number; onNavigate?: (step: ProgressStep) => void }) {
  const activeIndex = progressSteps.findIndex((item) => item.value === currentStep);

  return <>
    <header className={styles.heading}><p className={styles.eyebrow}>{eyebrow}</p><h1 data-location-flow-heading tabIndex={-1}>{title}</h1><p>{description}</p></header>
    <ol className={styles.progress} aria-label="Report location progress">
      {progressSteps.map((item, index) => <li key={item.value} data-status={index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming"} aria-current={index === activeIndex ? "step" : undefined}><button type="button" disabled={!onNavigate || index > (furthestStep ?? activeIndex) || index === activeIndex} onClick={() => onNavigate?.(item.value)}><span aria-hidden="true">{index + 1}</span><strong>{item.label}</strong></button></li>)}
    </ol>
  </>;
}

function pinFromPercent(x: number, y: number): MapPin {
  return {
    x,
    y,
    latitude: malaysiaBounds.north - (y / 100) * (malaysiaBounds.north - malaysiaBounds.south),
    longitude: malaysiaBounds.west + (x / 100) * (malaysiaBounds.east - malaysiaBounds.west),
  };
}

function normalisePin(pin: MapPin | null) {
  if (!pin) return null;
  if (Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)) return pin;
  return pinFromPercent(pin.x, pin.y);
}

function mapCoordinates(pin: MapPin | null) {
  if (!pin) return null;
  const resolved = normalisePin(pin);
  return resolved ? `${resolved.latitude.toFixed(5)}, ${resolved.longitude.toFixed(5)}` : null;
}

function isWithinSupportedMalaysiaArea(pin: MapPin) {
  return pin.latitude >= malaysiaBounds.south
    && pin.latitude <= malaysiaBounds.north
    && pin.longitude >= malaysiaBounds.west
    && pin.longitude <= malaysiaBounds.east;
}

function MapPreview({ pin, siteCentre, interactive = false, onSetPin }: { pin: MapPin | null; siteCentre?: MapPin | null; interactive?: boolean; onSetPin?: (pin: MapPin) => void }) {
  const resolvedPin = normalisePin(pin);
  return <MalaysiaMap pin={resolvedPin} siteCentre={siteCentre ?? null} diveSiteRadiusMetres={diveSiteRadiusMetres} islandRadiusMetres={islandRadiusMetres} interactive={interactive} onSetPin={onSetPin} />;
}

function distanceMetres(first: MapPin, second: MapPin) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LocationFlow() {
  const { reportDraft, locationDraft, updateLocationDraft } = useMockAppState();
  const {
    step,
    sessions,
    selectedSessionId,
    form,
    pin,
    locationSource,
    confidence,
    surfaceEntryContext,
    surfaceExitContext,
  } = locationDraft;
  const [sessionError, setSessionError] = useState("");
  const [dateError, setDateError] = useState("");
  const [confidenceError, setConfidenceError] = useState("");
  const [diveSites, setDiveSites] = useState<DiveSiteReference[]>([]);
  const [siteLoadError, setSiteLoadError] = useState("");
  const [sessionLoadError, setSessionLoadError] = useState("");
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [referenceReloadKey, setReferenceReloadKey] = useState(0);
  const [savingSession, setSavingSession] = useState(false);
  const [manualLatitude, setManualLatitude] = useState(pin?.latitude?.toFixed(6) ?? "");
  const [manualLongitude, setManualLongitude] = useState(pin?.longitude?.toFixed(6) ?? "");
  const [coordinateError, setCoordinateError] = useState("");
  const [mapPinError, setMapPinError] = useState("");
  const [locationCheckError, setLocationCheckError] = useState("");
  const [checkingLocation, setCheckingLocation] = useState(false);
  const initiallySelectedSessionId = useRef(selectedSessionId);
  const initialForm = useRef(form);
  const session = useMemo(() => sessions.find((item) => item.id === selectedSessionId) ?? sessions[0], [selectedSessionId, sessions]);
  const siteProfile = useMemo(() => reefSites.find((site) => site.backendDiveSiteId === session?.namedDiveSiteId), [session?.namedDiveSiteId]);
  const siteCentre = useMemo<MapPin | null>(() => siteProfile ? {
    latitude: siteProfile.position[0],
    longitude: siteProfile.position[1],
    x: ((siteProfile.position[1] - malaysiaBounds.west) / (malaysiaBounds.east - malaysiaBounds.west)) * 100,
    y: ((malaysiaBounds.north - siteProfile.position[0]) / (malaysiaBounds.north - malaysiaBounds.south)) * 100,
  } : null, [siteProfile]);
  const sessionTitle = session ? `${session.site}${session.label ? ` - ${session.label}` : ""}` : "No Dive Session selected";
  const confidenceLabel = confidenceOptions.find((item) => item.value === confidence)?.label ?? "Not provided";
  const coordinates = mapCoordinates(pin);
  const aiSiteReference = reportDraft?.aiSuggestions?.find((suggestion) =>
    suggestion.field === "site_reference"
    && suggestion.status !== "removed"
    && suggestion.suggestedValue)?.suggestedValue ?? null;
  const photoEvidenceDates = new Set((reportDraft?.photos ?? [])
    .filter((photo) => photo.capturedAtConfirmed && photo.capturedAt)
    .map((photo) => inputDateToDisplayValue((photo.capturedAt as string).slice(0, 10))));
  const hasExactCoordinates = locationSource === "map_pin" || locationSource === "manual_coordinates";
  const availableConfidenceOptions = hasExactCoordinates
    ? confidenceOptions.filter((item) => item.value !== "dive_site_only")
    : confidenceOptions.filter((item) => item.value === "dive_site_only" || item.value === "unsure");
  const currentProgressStep: ProgressStep = step === "saved" ? "review" : step === "create" ? "session" : step;
  const currentProgressIndex = progressSteps.findIndex((item) => item.value === currentProgressStep);
  const [furthestProgressIndex, setFurthestProgressIndex] = useState(currentProgressIndex);
  const setStep = (nextStep: typeof step) => {
    const nextProgressStep: ProgressStep = nextStep === "saved" ? "review" : nextStep === "create" ? "session" : nextStep;
    const nextIndex = progressSteps.findIndex((item) => item.value === nextProgressStep);
    setFurthestProgressIndex((current) => Math.max(current, nextIndex));
    updateLocationDraft({ step: nextStep });
  };
  const navigateProgress = (target: ProgressStep) => {
    const index = progressSteps.findIndex((item) => item.value === target);
    if (index > furthestProgressIndex) return;
    setStep(target === "review" ? "saved" : target);
  };
  const updateForm = (changes: Partial<typeof form>) => updateLocationDraft({ form: { ...form, ...changes } });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getDiveSites(), getDiveSessions()])
      .then(([siteResult, sessionResult]) => {
        if (cancelled) return;
        const storedSite = readSelectedReefSite();
        let matchedSite: DiveSiteReference | undefined;
        if (siteResult.status === "fulfilled") {
          setDiveSites(siteResult.value);
          matchedSite = storedSite
            ? siteResult.value.find((site) =>
                site.diveSiteId === storedSite.backendDiveSiteId
                || site.name.toLowerCase() === storedSite.name.toLowerCase()
                || (
                  site.publicAreaLabel.toLowerCase() === storedSite.publicAreaLabel.toLowerCase()
                  && site.name.toLowerCase().includes(storedSite.name.toLowerCase())
                ),
              )
            : undefined;
        } else {
          setSiteLoadError(userFacingError(siteResult.reason, "Dive sites are temporarily unavailable. Please try again."));
        }
        if (sessionResult.status === "rejected") {
          setSessionLoadError(userFacingError(sessionResult.reason, "Your Dive Sessions could not be loaded. Please try again."));
          return;
        }
        const backendSessions = sessionResult.value;
        const nextSessions: DiveSession[] = backendSessions.map((item) => ({
          id: `backend-session-${item.diveSessionId}`,
          backendId: item.diveSessionId,
          namedDiveSiteId: item.namedDiveSite.diveSiteId,
          site: `${item.namedDiveSite.name} — ${item.namedDiveSite.publicAreaLabel}`,
          label: item.label ?? undefined,
          date: inputDateToDisplayValue(item.diveDate),
          start: item.approximateStartTime ? new Date(item.approximateStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
          end: item.approximateEndTime ? new Date(item.approximateEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
        }));
        const currentSelection = nextSessions.find((item) => item.id === initiallySelectedSessionId.current)?.id;
        const selectedId = currentSelection ?? nextSessions[0]?.id ?? "";
        const selectedSiteForm = matchedSite
          ? {
              ...initialForm.current,
              site: String(matchedSite.diveSiteId),
              date: initialForm.current.date || reportDraft?.observationDate || "",
            }
          : initialForm.current;
        updateLocationDraft({
          sessions: nextSessions,
          selectedSessionId: selectedId,
          ...(matchedSite ? {
            form: selectedSiteForm,
            step: "create",
          } : {}),
        });
        if (matchedSite) clearSelectedReefSite();
      }).finally(() => {
        if (!cancelled) setLoadingReferences(false);
      });
    return () => {
      cancelled = true;
    };
  }, [referenceReloadKey, reportDraft?.observationDate, updateLocationDraft]);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("[data-location-flow-heading]");
    if (heading) {
      heading.style.outline = "none";
      heading.style.outlineOffset = "0";
      heading.style.boxShadow = "none";
      heading.focus({ preventScroll: true });
    }
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [step]);

  const createSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.site.trim()) { setSessionError("Enter or select a named dive site."); return; }
    setSessionError("");
    if (!isValidDisplayDate(form.date)) { setDateError("Enter the date in dd/mm/yyyy format, for example 26/08/2026."); return; }
    if (isFutureDisplayDate(form.date)) { setDateError("Dive date cannot be in the future."); return; }
    if (form.start && form.end && form.end <= form.start) { setDateError("Approximate end time must be after the start time."); return; }
    const selectedSite = diveSites.find((item) => String(item.diveSiteId) === form.site);
    if (!selectedSite) { setSessionError("Select a named dive site from the list."); return; }
    setSavingSession(true);
    try {
      const created = await createDiveSession({
        namedDiveSiteId: selectedSite.diveSiteId,
        diveDate: displayDateToIsoDate(form.date),
        ...(form.label.trim() ? { label: form.label.trim() } : {}),
        ...(form.start ? { approximateStartTime: displayDateAndTimeToIso(form.date, form.start) } : {}),
        ...(form.end ? { approximateEndTime: displayDateAndTimeToIso(form.date, form.end) } : {}),
      });
      const next: DiveSession = { id: `backend-session-${created.diveSessionId}`, backendId: created.diveSessionId, namedDiveSiteId: created.namedDiveSite.diveSiteId, site: `${created.namedDiveSite.name} — ${created.namedDiveSite.publicAreaLabel}`, label: created.label ?? undefined, date: inputDateToDisplayValue(created.diveDate), start: form.start || undefined, end: form.end || undefined };
      updateLocationDraft({ sessions: [...sessions, next], selectedSessionId: next.id, step: "location" });
      setFurthestProgressIndex((current) => Math.max(current, 1));
      setSessionError("");
      setDateError("");
    } catch (error) {
      setSessionError(userFacingError(error, "The Dive Session could not be created."));
    } finally {
      setSavingSession(false);
    }
  };
  const checkExactLocation = async (source: "map_pin" | "manual_coordinates", nextPin: MapPin) => {
    setLocationCheckError("");
    if (!isWithinSupportedMalaysiaArea(nextPin)) {
      const message = "Select a location within Malaysia or its supported surrounding waters before continuing.";
      if (source === "map_pin") setMapPinError(message);
      else setCoordinateError(message);
      return false;
    }
    if (siteCentre) {
      const distance = distanceMetres(siteCentre, nextPin);
      if (distance > islandRadiusMetres) {
        const message = "The supplied location appears far from the selected dive site (more than 15 km) and outside the island area. Choose a closer location before continuing.";
        if (source === "map_pin") setMapPinError(message);
        else setCoordinateError(message);
        return false;
      }
      if (distance > diveSiteRadiusMetres) {
        const confirmed = window.confirm("The supplied location appears beyond the dive site, but within the island area. Do you want to proceed with this location?");
        if (!confirmed) {
          const message = "Choose a location within 5 km of the dive site, or confirm the wider island-area location.";
          if (source === "map_pin") setMapPinError(message);
          else setCoordinateError(message);
          return false;
        }
      }
    }
    const payload = buildLocationCheckPayload({ ...locationDraft, locationSource: source, pin: nextPin });
    if (!payload) return true;
    setCheckingLocation(true);
    try {
      const result = await checkReportLocation(payload);
      if (result.hasWarning && !siteCentre) {
        const message = result.message ?? "This location is too far from the selected dive site. Choose a closer location before continuing.";
        if (source === "map_pin") setMapPinError(message);
        else setCoordinateError(message);
        return false;
      }
      return true;
    } catch (error) {
      setLocationCheckError(userFacingError(error, "The site-to-pin check is temporarily unavailable. The Malaysia location check was still applied."));
      return true;
    } finally {
      setCheckingLocation(false);
    }
  };
  const continueFromLocation = async (source: "dive_site" | "map_pin") => {
    if (source === "map_pin") {
      const resolvedPin = normalisePin(pin);
      if (!resolvedPin || !(await checkExactLocation("map_pin", resolvedPin))) return;
    }
    updateLocationDraft({ locationSource: source, pin: source === "dive_site" ? null : pin, confidence: source === "dive_site" ? "dive_site_only" : "", step: "confirm" });
    setFurthestProgressIndex((current) => Math.max(current, 2));
    setConfidenceError("");
    setMapPinError("");
  };
  const continueWithManualCoordinates = async () => {
    const latitude = Number(manualLatitude);
    const longitude = Number(manualLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setCoordinateError("Enter valid latitude and longitude values.");
      return;
    }
    const nextPin = {
      latitude,
      longitude,
      x: ((longitude - malaysiaBounds.west) / (malaysiaBounds.east - malaysiaBounds.west)) * 100,
      y: ((malaysiaBounds.north - latitude) / (malaysiaBounds.north - malaysiaBounds.south)) * 100,
    };
    if (!(await checkExactLocation("manual_coordinates", nextPin))) return;
    setCoordinateError("");
    updateLocationDraft({ locationSource: "manual_coordinates", pin: nextPin, confidence: "", step: "confirm" });
    setFurthestProgressIndex((current) => Math.max(current, 2));
  };
  const continueWithUnknownLocation = () => {
    setCoordinateError("");
    updateLocationDraft({ locationSource: "dive_site", pin: null, confidence: "unsure", step: "confirm" });
    setFurthestProgressIndex((current) => Math.max(current, 2));
  };
  const confirmLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confidence) { setConfidenceError("Select a location-confidence option before continuing."); return; }
    setConfidenceError("");
    setStep("privacy");
  };
  const retryReferences = () => {
    setLoadingReferences(true);
    setSiteLoadError("");
    setSessionLoadError("");
    setReferenceReloadKey((value) => value + 1);
  };

  if (step === "create") return <section className={styles.page}>
    <PageHeading eyebrow="Report a Reef / Dive details" title="Add a Dive Session" description="Enter the dive site, then add the date, dive number or approximate times if known." currentStep="session" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    <form className={styles.formLayout} onSubmit={createSession} noValidate>
      <section className={styles.card}><h2>Session details</h2><div className={styles.formGrid}>
        <label className={styles.field}>Named dive site *<span>Select from ReefCare&apos;s approved site list</span><select value={form.site} disabled={loadingReferences || diveSites.length === 0} onChange={(event) => { updateForm({ site: event.target.value }); setSessionError(""); }} aria-invalid={Boolean(sessionError)} aria-describedby={sessionError ? "site-error" : undefined}><option value="">{loadingReferences ? "Loading dive sites…" : "Select a dive site"}</option>{diveSites.map((site) => <option value={site.diveSiteId} key={site.diveSiteId}>{site.name} — {site.publicAreaLabel}</option>)}</select></label>
        <label className={styles.field}>Session label / dive number <span>Optional</span><input value={form.label} onChange={(event) => updateForm({ label: event.target.value })} placeholder="Dive 2" /></label>
        <div className={styles.field}>Dive date *<span>Use dd/mm/yyyy</span><DisplayDateInput label="Dive date" required value={form.date} onChange={(value) => { updateForm({ date: value }); setDateError(""); }} invalid={Boolean(dateError)} describedBy={dateError ? "date-error" : undefined} /></div>
        <div className={styles.timeFields}><label className={styles.field}>Approximate start <span>Optional</span><input type="time" value={form.start} onChange={(event) => updateForm({ start: event.target.value })} /></label><label className={styles.field}>Approximate end <span>Optional</span><input type="time" value={form.end} onChange={(event) => updateForm({ end: event.target.value })} /></label></div>
      </div>{siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}{sessionError && <p className={styles.errorText} id="site-error" role="alert">{sessionError}</p>}{dateError && <p className={styles.errorText} id="date-error" role="alert">{dateError}</p>}<p className={styles.supporting}>Choose a named dive site and dive date. The session label and approximate times are optional.</p><div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("session")}>Back</button><button className={styles.primaryButton} type="submit" disabled={savingSession || loadingReferences || Boolean(siteLoadError)}>{savingSession ? "Saving…" : "Save session"}</button></div></section>
    </form>
  </section>;

  if (loadingReferences) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading eyebrow="Report a Reef / Dive details" title="Preparing your Dive Sessions" description="We are checking for sessions that can be linked to this observation." currentStep="session" />
    <section className={`${styles.card} ${styles.stateCard}`} role="status"><strong>Loading Dive Sessions...</strong><p className={styles.supporting}>This should only take a moment.</p></section>
  </section>;

  if (sessionLoadError) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading eyebrow="Report a Reef / Dive details" title="We could not load your Dive Sessions" description="Try the request again before choosing or creating a session." currentStep="session" />
    <section className={`${styles.card} ${styles.stateCard}`} role="alert"><p className={styles.errorText}>{sessionLoadError}</p><button className={styles.primaryButton} type="button" onClick={retryReferences}>Try again</button></section>
  </section>;

  if (sessions.length === 0) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading eyebrow="Report a Reef / Dive details" title="Create your first Dive Session" description="A Dive Session keeps the site, date and photographs from the same dive together." currentStep="session" />
    <section className={`${styles.card} ${styles.emptyState}`}>
      <div><h2>No Dive Sessions yet</h2><p className={styles.supporting}>Add one session to continue this report. You only need a named dive site and dive date.</p></div>
      {siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}
      <button className={styles.primaryButton} type="button" disabled={Boolean(siteLoadError)} onClick={() => setStep("create")}>Create Dive Session</button>
    </section>
  </section>;

  if (!session && step !== "session") return <section className={styles.page}><PageHeading eyebrow="Report a Reef / Dive details" title="Choose a Dive Session first" description="Choose or create a Dive Session before adding location details." currentStep="session" /><section className={styles.card}>{sessionLoadError && <p className={styles.errorText} role="alert">{sessionLoadError}</p>}<button className={styles.primaryButton} type="button" onClick={() => setStep("session")}>Return to Dive Sessions</button></section></section>;

  if (step === "location") return <section className={styles.page}>
    <PageHeading eyebrow="Report a Reef / Location" title="Where on the reef did you observe it?" description="Use the Dive Session site, select a map point, enter coordinates or say that the exact location is unknown." currentStep="location" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    {aiSiteReference && <aside className={styles.aiLocationNote} role="note"><strong>Location reference from your description</strong><p>{aiSiteReference}</p><small>This is a contextual note only. Confirm the Dive Session, location source and accuracy below.</small></aside>}
    {locationCheckError && <aside className={styles.locationWarning} role="status"><strong>Location check</strong><p>{locationCheckError}</p></aside>}
    <div className={`${styles.choiceGrid} ${styles.locationChoices}`}><section className={`${styles.card} ${styles.selectedCard}`}><h2>General dive-site location</h2><div className={styles.readOnlyLabel}>Named dive site *<p className={styles.readOnlyValue}>{session.site}</p></div><div className={styles.infoBox}><strong>Exact location optional</strong><p>You can continue with the named site when precise coordinates are unavailable.</p></div><button className={styles.primaryButton} type="button" onClick={() => continueFromLocation("dive_site")}>Use dive-site location</button><button className={styles.textRetry} type="button" onClick={continueWithUnknownLocation}>I don&apos;t know the exact location</button></section>
      <section className={styles.card}><h2>Select on map</h2><p className={styles.supporting}>Select the approximate location where you made the observation.</p><MapPreview pin={pin} siteCentre={siteCentre} interactive onSetPin={(nextPin) => { updateLocationDraft({ pin: nextPin }); setMapPinError(""); }} />{coordinates && <p className={styles.coordinateReadout}>Selected coordinates: {coordinates}</p>}{mapPinError && <p className={styles.errorText} role="alert">{mapPinError}</p>}<button className={styles.secondaryButton} type="button" disabled={!pin || checkingLocation} onClick={() => continueFromLocation("map_pin")}>{checkingLocation ? "Checking location…" : "Confirm map pin"}</button></section>
      <section className={styles.card}><h2>Enter coordinates</h2><p className={styles.supporting}>Use coordinates from a dive computer, GPS device or another trusted source.</p><div className={styles.coordinateFields}><label className={styles.field}>Latitude<input type="number" min={malaysiaBounds.south} max={malaysiaBounds.north} step="any" value={manualLatitude} onChange={(event) => { setManualLatitude(event.target.value); setCoordinateError(""); }} placeholder="3.15021" /></label><label className={styles.field}>Longitude<input type="number" min={malaysiaBounds.west} max={malaysiaBounds.east} step="any" value={manualLongitude} onChange={(event) => { setManualLongitude(event.target.value); setCoordinateError(""); }} placeholder="104.21864" /></label></div>{coordinateError && <p className={styles.errorText} role="alert">{coordinateError}</p>}<button className={styles.secondaryButton} type="button" disabled={checkingLocation} onClick={continueWithManualCoordinates}>{checkingLocation ? "Checking location…" : "Use these coordinates"}</button></section></div>
    <aside className={styles.privacyStrip}><strong>Coordinates are optional</strong><p>Coordinates are stored only when you provide a map pin. Other users receive only the appropriate general-location view.</p></aside><button className={`${styles.secondaryButton} ${styles.backOutside}`} type="button" onClick={() => setStep("session")}>Back to Dive Session</button>
  </section>;

  if (step === "confirm") return <section className={styles.page}>
    <PageHeading eyebrow="Report a Reef / Location" title="Confirm the map location" description="Check the location and choose the option that best describes its accuracy." currentStep="confirm" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    <form className={styles.confirmGrid} onSubmit={confirmLocation}>
      <section className={styles.card}>
        <h2>{session.site}</h2>
        <MapPreview pin={pin} siteCentre={siteCentre} />
        <p className={styles.mapCaption}>{hasExactCoordinates ? `${locationSource === "manual_coordinates" ? "Entered coordinates" : "Selected map pin"}${coordinates ? ` — ${coordinates}` : ""}` : confidence === "unsure" ? "Exact location unknown" : "Named dive-site location only"}</p>
        <section className={styles.surfaceContext} aria-labelledby="surface-context-heading">
          <h3 id="surface-context-heading">Optional surface entry and exit context</h3>
          <p className={styles.supporting}>Add surface-only context if it may help a reviewer. These notes are not treated as the exact underwater threat location.</p>
          <label className={styles.field}>
            Surface entry context <span>Optional</span>
            <textarea
              maxLength={450}
              value={surfaceEntryContext}
              onChange={(event) => updateLocationDraft({ surfaceEntryContext: event.target.value })}
              placeholder="For example, entered from the boat north of the site"
            />
          </label>
          <label className={styles.field}>
            Surface exit context <span>Optional</span>
            <textarea
              maxLength={450}
              value={surfaceExitContext}
              onChange={(event) => updateLocationDraft({ surfaceExitContext: event.target.value })}
              placeholder="For example, surfaced beside the mooring line"
            />
          </label>
        </section>
      </section>
      <aside className={styles.card}>
        <fieldset className={styles.confidenceList}>
          <legend>Location confidence</legend>
          {availableConfidenceOptions.map((item) => <label key={item.value}><input type="radio" name="confidence" value={item.value} checked={confidence === item.value} onChange={() => updateLocationDraft({ confidence: item.value })} />{item.label}</label>)}
        </fieldset>
        <p className={styles.supporting}>{hasExactCoordinates ? "Choose how closely the coordinates represent the observed location." : "Choose Dive-site only or Unsure."}</p>
        {confidenceError && <p className={styles.errorText} role="alert">{confidenceError}</p>}
        <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("location")}>Back</button><button className={styles.primaryButton} type="submit" disabled={checkingLocation}>{checkingLocation ? "Checking…" : "Confirm location"}</button></div>
      </aside>
    </form>
  </section>;

  if (step === "privacy") return <section className={styles.page}>
    <PageHeading eyebrow="Report a Reef / Location privacy" title="Review your location privacy" description="See how ReefCare protects the precise location you submitted." currentStep="privacy" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    <div className={styles.privacyGrid}><section className={styles.card}><h2>Your submitted location</h2><MapPreview pin={pin} /><p><strong>{hasExactCoordinates ? `Coordinates within ${session.site}` : session.site}</strong></p><p>Confidence: <strong>{confidenceLabel}</strong></p><p className={styles.supporting}>You will see this location in your own report.</p>{(surfaceEntryContext.trim() || surfaceExitContext.trim()) && <div className={styles.contextNotice}><strong>Surface entry and exit context</strong><p>These optional notes are kept as supporting context and are not treated as the exact underwater threat location.</p></div>}</section><section className={`${styles.card} ${styles.sidePanel}`}><h2>Who can see what?</h2><dl className={styles.accessList}><div><dt>You</dt><dd>Your submitted location</dd></div><div><dt>Claiming Case Coordinator</dt><dd>Your location, accuracy and optional surface context</dd></div><div><dt>Other coordinators</dt><dd>General site until they claim the case</dd></div><div><dt>System Administrator</dt><dd>General site only</dd></div><div><dt>Unauthenticated visitors</dt><dd>Report location is not displayed</dd></div></dl></section></div>
    <div className={styles.splitActions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("confirm")}>Back</button><button className={styles.primaryButton} type="button" onClick={() => setStep("saved")}>Confirm privacy and continue</button></div>
  </section>;

  if (step === "saved") return <section className={styles.page}>
    <PageHeading eyebrow="Report a Reef / Location" title="Location saved to your draft" description="Review the Dive Session, map pin and location accuracy saved with this report draft." currentStep="review" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    <div className={styles.savedGrid}><section className={styles.card}><h2>Current report draft</h2><p className={styles.supporting}>A report reference will be created after final submission.</p><div className={styles.savedContent}><MapPreview pin={pin} /><dl className={styles.detailList}><div><dt>Dive Session</dt><dd>{sessionTitle}</dd></div><div><dt>Location source</dt><dd>{locationSource === "manual_coordinates" ? "Entered coordinates" : locationSource === "map_pin" ? "Map pin" : confidence === "unsure" ? "Exact location unknown" : "Named dive site"}</dd></div><div><dt>Location confidence</dt><dd>{confidenceLabel}</dd></div>{coordinates && <div><dt>Selected coordinates</dt><dd>{coordinates}</dd></div>}{surfaceEntryContext.trim() && <div><dt>Surface entry context</dt><dd>{surfaceEntryContext.trim()}</dd></div>}{surfaceExitContext.trim() && <div><dt>Surface exit context</dt><dd>{surfaceExitContext.trim()}</dd></div>}</dl></div></section><aside className={styles.sidePanel}><h2>Privacy reminder</h2><p>Exact submitted coordinates are visible only to you and the Case Coordinator who claims the case.</p><div className={styles.purpleBox}><strong>General site</strong><p>{session.site} is retained as the restricted location view.</p></div></aside></div>
    <div className={styles.splitActions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("privacy")}>Back</button><Link className={styles.primaryButton} href="/report-a-reef/review">Continue to review</Link></div>
  </section>;

  return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading eyebrow="Report a Reef / Dive details" title="Which dive was this observation from?" description="Select a recent dive or add a new Dive Session with a named site and dive date." currentStep="session" furthestStep={furthestProgressIndex} onNavigate={navigateProgress} />
    <div className={styles.choiceGrid}><section className={`${styles.card} ${styles.selectedCard}`}><h2>Use an existing Dive Session</h2><p className={styles.supporting}>Choose a recent session connected to this report.</p>{photoEvidenceDates.size > 0 && <p className={styles.metadataNotice}>Sessions matching the photo file date are marked as suggestions. You still choose the session.</p>}<fieldset className={styles.sessionList}><legend className="sr-only">Recent Dive Sessions</legend>{sessions.map((item) => <label className={styles.sessionOption} key={item.id}><input type="radio" name="dive-session" value={item.id} checked={selectedSessionId === item.id} onChange={() => updateLocationDraft({ selectedSessionId: item.id })} /><span><strong>{item.site}{item.label ? ` - ${item.label}` : ""}</strong><small>{[item.date, item.start && item.end ? `${item.start} to ${item.end}` : item.start].filter(Boolean).join(" - ") || "Optional details not provided"}</small>{item.date && photoEvidenceDates.has(item.date) && <em className={styles.suggestedSession}>Suggested from photo file date</em>}</span></label>)}</fieldset><button className={styles.primaryButton} type="button" disabled={!session} onClick={() => setStep("location")}>Use selected session</button></section>
      <section className={styles.card}><h2>Create a new Dive Session</h2><p className={styles.supporting}>Use this when the observation is not linked to an existing session.</p>{siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}<div className={styles.requirementGroup}><h3>Required details</h3><p><span aria-hidden="true">✓</span> Named dive site</p><p><span aria-hidden="true">✓</span> Dive date</p></div><div className={styles.requirementGroup}><h3>Optional details</h3><p><span aria-hidden="true">□</span> Session label or dive number</p><p><span aria-hidden="true">□</span> Approximate start and end times</p></div><button className={styles.secondaryButton} type="button" disabled={Boolean(siteLoadError) || loadingReferences} onClick={() => setStep("create")}>Create Dive Session</button></section></div>
    <aside className={styles.infoPanel}><strong>Why add a Dive Session?</strong><p>It keeps observations, photographs and location details from the same dive together.</p></aside>
  </section>;
}

export function ReviewLocationSummary() {
  const { locationDraft, reportDraft } = useMockAppState();
  const session = locationDraft.sessions.find((item) => item.id === locationDraft.selectedSessionId);
  const confidenceLabel = confidenceOptions.find((item) => item.value === locationDraft.confidence)?.label;
  const coordinates = mapCoordinates(locationDraft.pin);
  const aiSiteReference = reportDraft?.aiSuggestions?.find((suggestion) => suggestion.field === "site_reference" && suggestion.status !== "removed")?.suggestedValue;
  return <section className={styles.card} aria-labelledby="review-location-heading"><h2 id="review-location-heading">Dive Session and location</h2><dl className={styles.detailList}><div><dt>Named dive site</dt><dd>{session?.site ?? "Not yet selected"}</dd></div>{aiSiteReference && <div><dt>Description location note</dt><dd>{aiSiteReference} <small>AI-assisted context only</small></dd></div>}<div><dt>Location source</dt><dd>{locationDraft.locationSource === "manual_coordinates" ? "Entered coordinates" : locationDraft.locationSource === "map_pin" ? "Optional map pin" : locationDraft.confidence === "unsure" ? "Exact location unknown" : "Named dive site"}</dd></div><div><dt>Location confidence</dt><dd>{confidenceLabel ?? "Not yet selected"}</dd></div>{coordinates && <div><dt>Selected coordinates</dt><dd>{coordinates}</dd></div>}{locationDraft.surfaceEntryContext.trim() && <div><dt>Surface entry context</dt><dd>{locationDraft.surfaceEntryContext.trim()} <small>Context only — not an exact underwater location</small></dd></div>}{locationDraft.surfaceExitContext.trim() && <div><dt>Surface exit context</dt><dd>{locationDraft.surfaceExitContext.trim()} <small>Context only — not an exact underwater location</small></dd></div>}</dl><Link className={styles.secondaryButton} href="/report-a-reef/location">Edit location</Link></section>;
}

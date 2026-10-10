"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
import { buildLocationCheckPayload } from "@/features/epic-02-reporting/report-payload";
import { ReportProgress } from "@/features/epic-02-reporting/report-progress";
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
const islandRadiusMetres = 15000;

const MalaysiaMap = dynamic(
  () => import("./malaysia-map").then((module) => module.MalaysiaMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Loading map…</div>,
  },
);

function PageHeading({ title, description }: { title: string; description: string }) {
  return <>
    <ReportProgress current={2} />
    <header className={styles.heading}><h1 data-location-flow-heading tabIndex={-1}>{title}</h1><p>{description}</p></header>
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

function MapPreview({ pin, siteCentre, siteName, diveSiteRadiusMetres, interactive = false, onSetPin }: { pin: MapPin | null; siteCentre?: MapPin | null; siteName: string | null; diveSiteRadiusMetres: number | null; interactive?: boolean; onSetPin?: (pin: MapPin) => void }) {
  const resolvedPin = normalisePin(pin);
  return <MalaysiaMap pin={resolvedPin} siteCentre={siteCentre ?? null} siteName={siteName} diveSiteRadiusMetres={diveSiteRadiusMetres} islandRadiusMetres={islandRadiusMetres} interactive={interactive} onSetPin={onSetPin} />;
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
  const router = useRouter();
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
  const siteReference = useMemo(
    () => diveSites.find((site) => site.diveSiteId === session?.namedDiveSiteId),
    [diveSites, session?.namedDiveSiteId],
  );
  const siteCentre = useMemo<MapPin | null>(() => {
    const latitude = siteReference?.centreLatitude;
    const longitude = siteReference?.centreLongitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
      x: ((Number(longitude) - malaysiaBounds.west) / (malaysiaBounds.east - malaysiaBounds.west)) * 100,
      y: ((malaysiaBounds.north - Number(latitude)) / (malaysiaBounds.north - malaysiaBounds.south)) * 100,
    };
  }, [siteReference]);
  const diveSiteRadiusMetres = Number.isFinite(siteReference?.defaultUncertaintyMetres)
    && Number(siteReference?.defaultUncertaintyMetres) > 0
    ? Number(siteReference?.defaultUncertaintyMetres)
    : null;
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
  const setStep = (nextStep: typeof step) => updateLocationDraft({ step: nextStep });
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
          setSessionLoadError(userFacingError(sessionResult.reason, "Your dives could not be loaded. Please try again."));
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
    // Drafts saved before this shorter flow may still point to removed screens.
    if (step === "privacy" || step === "saved") updateLocationDraft({ step: "confirm" });
  }, [step, updateLocationDraft]);

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
      setSessionError("");
      setDateError("");
    } catch (error) {
      setSessionError(userFacingError(error, "This dive could not be saved."));
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
      if (diveSiteRadiusMetres && distance > diveSiteRadiusMetres) {
        const confirmed = window.confirm("The supplied location appears beyond the dive site, but within the island area. Do you want to proceed with this location?");
        if (!confirmed) {
          const radiusLabel = diveSiteRadiusMetres >= 1000
            ? `${diveSiteRadiusMetres / 1000} km`
            : `${diveSiteRadiusMetres} m`;
          const message = `Choose a location within ${radiusLabel} of the dive site, or confirm the wider island-area location.`;
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
  };
  const continueWithUnknownLocation = () => {
    setCoordinateError("");
    updateLocationDraft({ locationSource: "dive_site", pin: null, confidence: "unsure", step: "confirm" });
  };
  const confirmLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confidence) { setConfidenceError("Select a location-confidence option before continuing."); return; }
    setConfidenceError("");
    router.push("/report-a-reef/review");
  };
  const retryReferences = () => {
    setLoadingReferences(true);
    setSiteLoadError("");
    setSessionLoadError("");
    setReferenceReloadKey((value) => value + 1);
  };

  const whoSees = <section className={styles.privacySummary} aria-labelledby="privacy-summary-heading">
    <h3 id="privacy-summary-heading">Who sees this location</h3>
    <dl className={styles.accessList}>
      <div><dt>You</dt><dd>Everything you entered</dd></div>
      <div><dt>The coordinator handling your report</dt><dd>Your location, accuracy and surface notes</dd></div>
      <div><dt>Everyone else</dt><dd>Only the general site, {session?.site ?? "never the exact point"}</dd></div>
    </dl>
  </section>;

  if (step === "create") return <section className={styles.page}>
    <PageHeading title="Add this dive" description="Choose the dive site and date. A dive number or rough times are optional." />
    <form className={styles.formLayout} onSubmit={createSession} noValidate>
      <section className={styles.card}><h2>Dive details</h2><div className={styles.formGrid}>
        <label className={styles.field}>Dive site *<span>From ReefCare&apos;s list of named sites</span><select value={form.site} disabled={loadingReferences || diveSites.length === 0} onChange={(event) => { updateForm({ site: event.target.value }); setSessionError(""); }} aria-invalid={Boolean(sessionError)} aria-describedby={sessionError ? "site-error" : undefined}><option value="">{loadingReferences ? "Loading dive sites…" : "Select a dive site"}</option>{diveSites.map((site) => <option value={site.diveSiteId} key={site.diveSiteId}>{site.name} — {site.publicAreaLabel}</option>)}</select></label>
        <label className={styles.field}>Dive number or label <span>Optional</span><input value={form.label} onChange={(event) => updateForm({ label: event.target.value })} placeholder="Dive 2" /></label>
        <div className={styles.field}>Dive date *<span>Use dd/mm/yyyy</span><DisplayDateInput label="Dive date" required value={form.date} onChange={(value) => { updateForm({ date: value }); setDateError(""); }} invalid={Boolean(dateError)} describedBy={dateError ? "date-error" : undefined} /></div>
        <div className={styles.timeFields}><label className={styles.field}>Rough start time <span>Optional</span><input type="time" value={form.start} onChange={(event) => updateForm({ start: event.target.value })} /></label><label className={styles.field}>Rough end time <span>Optional</span><input type="time" value={form.end} onChange={(event) => updateForm({ end: event.target.value })} /></label></div>
      </div>{siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}{sessionError && <p className={styles.errorText} id="site-error" role="alert">{sessionError}</p>}{dateError && <p className={styles.errorText} id="date-error" role="alert">{dateError}</p>}<div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("session")}>Back</button><button className={styles.primaryButton} type="submit" disabled={savingSession || loadingReferences || Boolean(siteLoadError)}>{savingSession ? "Saving…" : "Save dive"}</button></div></section>
    </form>
  </section>;

  if (loadingReferences) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading title="Loading your dives" description="Checking for dives you have already added." />
    <section className={`${styles.card} ${styles.stateCard}`} role="status"><strong>Loading your dives…</strong><p className={styles.supporting}>This should only take a moment.</p></section>
  </section>;

  if (sessionLoadError) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading title="We could not load your dives" description="Your report is still saved. Try again to continue." />
    <section className={`${styles.card} ${styles.stateCard}`} role="alert"><p className={styles.errorText}>{sessionLoadError}</p><button className={styles.primaryButton} type="button" onClick={retryReferences}>Try again</button></section>
  </section>;

  if (sessions.length === 0) return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading title="Add the dive where you saw this" description="Linking the dive keeps the site, date and photos from that dive together." />
    <section className={`${styles.card} ${styles.emptyState}`}>
      <div><h2>No dives added yet</h2><p className={styles.supporting}>You only need the dive site and the date.</p></div>
      {siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}
      <button className={styles.primaryButton} type="button" disabled={Boolean(siteLoadError)} onClick={() => setStep("create")}>Add a dive</button>
    </section>
  </section>;

  if (!session && step !== "session") return <section className={styles.page}><PageHeading title="Choose a dive first" description="Choose or add the dive before adding location details." /><section className={styles.card}>{sessionLoadError && <p className={styles.errorText} role="alert">{sessionLoadError}</p>}<button className={styles.primaryButton} type="button" onClick={() => setStep("session")}>Choose a dive</button></section></section>;

  if (step === "location") return <section className={styles.page}>
    <PageHeading title="Where on the reef was it?" description="The dive site is enough. Add a map point or coordinates only if you know them." />
    {aiSiteReference && <aside className={styles.aiLocationNote} role="note"><strong>Location mentioned in your description</strong><p>{aiSiteReference}</p><small>Context only. Choose the location below.</small></aside>}
    {locationCheckError && <aside className={styles.locationWarning} role="status"><strong>Location check</strong><p>{locationCheckError}</p></aside>}
    <div className={`${styles.choiceGrid} ${styles.locationChoices}`}><section className={`${styles.card} ${styles.selectedCard}`}><h2>Use the dive site</h2><div className={styles.readOnlyLabel}>Dive site<p className={styles.readOnlyValue}>{session.site}</p></div><p className={styles.supporting}>Most reports use this. Precise coordinates are optional.</p><button className={styles.primaryButton} type="button" onClick={() => continueFromLocation("dive_site")}>Use dive-site location</button><button className={styles.textRetry} type="button" onClick={continueWithUnknownLocation}>I don&apos;t know the exact location</button></section>
      <section className={styles.card}><h2>Point on the map</h2><p className={styles.supporting}>Select the approximate spot where you saw it.</p><MapPreview pin={pin} siteCentre={siteCentre} siteName={siteReference?.name ?? null} diveSiteRadiusMetres={diveSiteRadiusMetres} interactive onSetPin={(nextPin) => { updateLocationDraft({ pin: nextPin }); setMapPinError(""); }} />{coordinates && <p className={styles.coordinateReadout}>Selected coordinates: {coordinates}</p>}{mapPinError && <p className={styles.errorText} role="alert">{mapPinError}</p>}<button className={styles.secondaryButton} type="button" disabled={!pin || checkingLocation} onClick={() => continueFromLocation("map_pin")}>{checkingLocation ? "Checking location…" : "Confirm map pin"}</button></section>
      <section className={styles.card}><h2>Enter coordinates</h2><p className={styles.supporting}>From a dive computer, GPS or another trusted source.</p><div className={styles.coordinateFields}><label className={styles.field}>Latitude<input type="number" min={malaysiaBounds.south} max={malaysiaBounds.north} step="any" value={manualLatitude} onChange={(event) => { setManualLatitude(event.target.value); setCoordinateError(""); }} placeholder="3.15021" /></label><label className={styles.field}>Longitude<input type="number" min={malaysiaBounds.west} max={malaysiaBounds.east} step="any" value={manualLongitude} onChange={(event) => { setManualLongitude(event.target.value); setCoordinateError(""); }} placeholder="104.21864" /></label></div>{coordinateError && <p className={styles.errorText} role="alert">{coordinateError}</p>}<button className={styles.secondaryButton} type="button" disabled={checkingLocation} onClick={continueWithManualCoordinates}>{checkingLocation ? "Checking location…" : "Use these coordinates"}</button></section></div>
    <aside className={styles.privacyStrip}><strong>Your exact location stays protected</strong><p>Only you and the coordinator handling your report see a map point or coordinates. Everyone else sees the general site.</p></aside><button className={`${styles.secondaryButton} ${styles.backOutside}`} type="button" onClick={() => setStep("session")}>Back</button>
  </section>;

  // "privacy" and "saved" were separate screens; drafts saved on them resume here.
  if (step === "confirm" || step === "privacy" || step === "saved") return <section className={styles.page}>
    <PageHeading title="How exact is this location?" description="Check the location, say how accurate it is, then continue to review." />
    <form className={styles.confirmGrid} onSubmit={confirmLocation}>
      <section className={styles.card}>
        <h2>{session.site}</h2>
        <MapPreview pin={pin} siteCentre={siteCentre} siteName={siteReference?.name ?? null} diveSiteRadiusMetres={diveSiteRadiusMetres} />
        <p className={styles.mapCaption}>{hasExactCoordinates ? `${locationSource === "manual_coordinates" ? "Entered coordinates" : "Selected map pin"}${coordinates ? ` — ${coordinates}` : ""}` : confidence === "unsure" ? "Exact location unknown" : "Named dive-site location only"}</p>
        <details className={styles.surfaceContext} open={Boolean(surfaceEntryContext.trim() || surfaceExitContext.trim()) || undefined}>
          <summary>Add where you entered or left the water <span>Optional</span></summary>
          <p className={styles.supporting}>Surface notes can help a reviewer. They are never treated as the exact underwater location.</p>
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
        </details>
      </section>
      <aside className={styles.card}>
        <fieldset className={styles.confidenceList} aria-describedby="confidence-help">
          <legend>Location accuracy</legend>
          <p className={styles.supporting} id="confidence-help">{hasExactCoordinates ? "How close is this point to where you saw it?" : "Choose dive-site only, or unsure."}</p>
          {availableConfidenceOptions.map((item) => <label key={item.value}><input type="radio" name="confidence" value={item.value} checked={confidence === item.value} onChange={() => { updateLocationDraft({ confidence: item.value }); setConfidenceError(""); }} />{item.label}</label>)}
        </fieldset>
        {confidenceError && <p className={styles.errorText} role="alert">{confidenceError}</p>}
        {whoSees}
        <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setStep("location")}>Back</button><button className={styles.primaryButton} type="submit" disabled={checkingLocation}>{checkingLocation ? "Checking…" : "Continue to review"}</button></div>
      </aside>
    </form>
  </section>;

  return <section className={styles.page}>
    <BackButton fallbackHref="/report-a-reef" label="Back to report form" />
    <PageHeading title="Which dive was this?" description="Choose a dive you have already added, or add this one." />
    <div className={styles.choiceGrid}><section className={`${styles.card} ${styles.selectedCard}`}><h2>Your recent dives</h2>{photoEvidenceDates.size > 0 && <p className={styles.metadataNotice}>Dives on the same date as your photos are marked. You still choose.</p>}<fieldset className={styles.sessionList}><legend className="sr-only">Recent dives</legend>{sessions.map((item) => <label className={styles.sessionOption} key={item.id}><input type="radio" name="dive-session" value={item.id} checked={selectedSessionId === item.id} onChange={() => updateLocationDraft({ selectedSessionId: item.id })} /><span><strong>{item.site}{item.label ? ` - ${item.label}` : ""}</strong><small>{[item.date, item.start && item.end ? `${item.start} to ${item.end}` : item.start].filter(Boolean).join(" - ") || "No date or times added"}</small>{item.date && photoEvidenceDates.has(item.date) && <em className={styles.suggestedSession}>Same date as your photos</em>}</span></label>)}</fieldset><button className={styles.primaryButton} type="button" disabled={!session} onClick={() => setStep("location")}>Use this dive</button></section>
      <section className={styles.card}><h2>Add a different dive</h2><p className={styles.supporting}>You need the dive site and date. A dive number and rough times are optional.</p>{siteLoadError && <div className={styles.inlineError} role="alert"><p>{siteLoadError}</p><button className={styles.textRetry} type="button" onClick={retryReferences}>Try again</button></div>}<button className={styles.secondaryButton} type="button" disabled={Boolean(siteLoadError) || loadingReferences} onClick={() => setStep("create")}>Add a dive</button></section></div>
  </section>;
}

export function ReviewLocationSummary() {
  const { locationDraft, reportDraft } = useMockAppState();
  const session = locationDraft.sessions.find((item) => item.id === locationDraft.selectedSessionId);
  const confidenceLabel = confidenceOptions.find((item) => item.value === locationDraft.confidence)?.label;
  const coordinates = mapCoordinates(locationDraft.pin);
  const aiSiteReference = reportDraft?.aiSuggestions?.find((suggestion) => suggestion.field === "site_reference" && suggestion.status !== "removed")?.suggestedValue;
  return <section className={styles.card} aria-labelledby="review-location-heading"><h2 id="review-location-heading">Dive and location</h2><dl className={styles.detailList}><div><dt>Dive site</dt><dd>{session?.site ?? "Not yet selected"}</dd></div>{aiSiteReference && <div><dt>Description location note</dt><dd>{aiSiteReference} <small>AI-assisted context only</small></dd></div>}<div><dt>Location source</dt><dd>{locationDraft.locationSource === "manual_coordinates" ? "Entered coordinates" : locationDraft.locationSource === "map_pin" ? "Optional map pin" : locationDraft.confidence === "unsure" ? "Exact location unknown" : "Named dive site"}</dd></div><div><dt>Location confidence</dt><dd>{confidenceLabel ?? "Not yet selected"}</dd></div>{coordinates && <div><dt>Selected coordinates</dt><dd>{coordinates}</dd></div>}{locationDraft.surfaceEntryContext.trim() && <div><dt>Surface entry context</dt><dd>{locationDraft.surfaceEntryContext.trim()} <small>Context only — not an exact underwater location</small></dd></div>}{locationDraft.surfaceExitContext.trim() && <div><dt>Surface exit context</dt><dd>{locationDraft.surfaceExitContext.trim()} <small>Context only — not an exact underwater location</small></dd></div>}</dl><Link className={styles.secondaryButton} href="/report-a-reef/location">Edit location</Link></section>;
}

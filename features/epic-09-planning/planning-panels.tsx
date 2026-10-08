"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CloudRain,
  ExternalLink,
  Info,
  MapPin,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";
import { useState } from "react";
import type { ReefSite } from "@/features/epic-02-reef-explorer/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import {
  dateLabel,
  labels,
  months,
  retrievedLabel,
  signalValue,
  type Area,
  type Assessment,
  type Band,
} from "./planning-data";
import type {
  BriefView,
  DaySummaryView,
  PlanningContext,
  PlanningSource,
} from "./planning-source";
import styles from "./planning.module.css";
import { surfaceImages } from "./surface-images";
import { useAsyncData, type AsyncData } from "./use-async-data";

export function LoadError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.error} role="alert">
      <p>{userFacingError(error, fallback)}</p>
      <button type="button" className={styles.textButton} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function BandPill({ band }: { band: Band }) {
  return (
    <span className={styles.pill} data-band={band}>
      <span aria-hidden="true" className={styles.dot} />
      {labels[band]}
    </span>
  );
}
function BreakdownBar({ breakdown }: { breakdown: DaySummaryView["breakdown"] }) {
  const parts = [
    { band: "more_favourable", value: breakdown.more_favourable },
    { band: "mixed", value: breakdown.mixed },
    { band: "less_favourable", value: breakdown.less_favourable },
  ] as const;
  const description = `${breakdown.more_favourable} more favourable, ${breakdown.mixed} mixed, ${breakdown.less_favourable} less favourable`;
  return (
    <span className={styles.breakdown} role="img" aria-label={description} title={description}>
      {parts.map((part) =>
        part.value > 0 ? (
          <span key={part.band} data-band={part.band} style={{ flexGrow: part.value }} />
        ) : null,
      )}
    </span>
  );
}
export function Signals({ assessment }: { assessment: Assessment }) {
  return (
    <div className={styles.signals}>
      <span>
        <Waves size={17} />
        {assessment.waves === null ? "—" : `${signalValue(assessment.waves)} m`}
        <small>Wave height</small>
      </span>
      <span>
        <Wind size={17} />
        {assessment.wind === null ? "—" : `${signalValue(assessment.wind)} km/h`}
        <small>Wind speed</small>
      </span>
      {assessment.rain !== null && (
        <span>
          <CloudRain size={17} />
          {`${assessment.rain}%`}
          <small>Rain chance</small>
        </span>
      )}
    </div>
  );
}
// Source, retrieval time and rule version, omitting any part the provider did not supply.
export function forecastProvenance(assessment: Assessment, sample: boolean): string {
  const retrieved = retrievedLabel(assessment.retrievedAt);
  return [
    sample ? "Sample forecast fixture" : `Source: ${assessment.source ?? "forecast provider"}`,
    retrieved ? `retrieved ${retrieved}` : null,
    assessment.ruleVersion ? `rule ${assessment.ruleVersion}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function Seasonality({
  area,
  source,
  today,
}: {
  area: Area;
  source: PlanningSource;
  today: string;
}) {
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const { state, retry } = useAsyncData(
    () => source.seasonality(area),
    [source, area],
  );
  const data = state.status === "ready" ? state.data : null;
  const selected = data?.months[month];
  return (
    <section className={styles.panel} aria-labelledby="season-heading">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="season-heading">A year around {area}</h2>
          <p>Typical conditions by month. Not a forecast.</p>
        </div>
        <CalendarDays size={25} />
      </div>
      {state.status === "loading" && (
        <p role="status">Loading seasonal reference…</p>
      )}
      {state.status === "error" && (
        <LoadError
          error={state.error}
          fallback="Seasonal reference could not be loaded."
          onRetry={retry}
        />
      )}
      {data && selected && (
        <>
          <div className={styles.months}>
            {months.map((label, index) => {
              const entry = data.months[index];
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMonth(index)}
                  aria-pressed={month === index}
                  className={styles.month}
                  data-season={entry.state}
                >
                  <span>{label}</span>
                  <span className={styles.seasonBar} />
                  <small>
                    {entry.state === "monsoon"
                      ? "Monsoon"
                      : entry.state === "transition"
                        ? "Transition"
                        : entry.state === "unreviewed"
                          ? "No data"
                          : "Typical"}
                  </small>
                </button>
              );
            })}
          </div>
          <div className={styles.seasonDetail}>
            <Info size={19} />
            <div>
              <strong>
                {months[month]} · {selected.headline}
              </strong>
              <p>{selected.detail}</p>
            </div>
          </div>
          <p className={styles.source}>{data.source}</p>
        </>
      )}
    </section>
  );
}
export function DateComparison({
  dates,
  summaries,
  onRetry,
  siteAssessments,
  total,
  selected,
  onSelect,
  mode,
}: {
  dates: string[];
  summaries: AsyncData<Record<string, DaySummaryView>>;
  onRetry: () => void;
  siteAssessments: Assessment[];
  total: number;
  selected: string;
  onSelect: (date: string) => void;
  mode: PlanningSource["mode"];
}) {
  const sample = mode === "sample";
  const summaryFor = (date: string): DaySummaryView =>
    (summaries.status === "ready" ? summaries.data[date] : undefined) ?? {
      band: "unavailable",
      count: 0,
      total,
      breakdown: { more_favourable: 0, mixed: 0, less_favourable: 0 },
      signals: null,
      reasons: [],
    };
  const current = summaryFor(selected);
  const waves = siteAssessments.flatMap((item) => item.waves === null ? [] : [item.waves]);
  const winds = siteAssessments.flatMap((item) => item.wind === null ? [] : [item.wind]);
  const rain = summaries.status === "ready" ? current.signals?.rain ?? null : null;
  const signalText = summaries.status === "ready" && current.signals
    ? [
        current.signals.waves !== null ? `waves ${signalValue(current.signals.waves)} m` : null,
        current.signals.wind !== null ? `wind ${signalValue(current.signals.wind)} km/h` : null,
        current.signals.rain !== null ? `rain chance ${current.signals.rain}%` : null,
      ].filter(Boolean).join(" · ")
    : "";
  const range = (values: number[]) => Math.min(...values) === Math.max(...values)
    ? signalValue(Math.min(...values))
    : `${signalValue(Math.min(...values))}–${signalValue(Math.max(...values))}`;
  return (
    <section className={styles.panel} aria-labelledby="dates-heading">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="dates-heading">Compare dates</h2>
          <p>Pick a day to see conditions at each site.</p>
        </div>
        <span className={styles.smallTag}>
          {sample ? "7-day sample forecast" : "7-day forecast"}
        </span>
      </div>
      {summaries.status === "error" && (
        <LoadError
          error={summaries.error}
          fallback="Forecast conditions could not be loaded."
          onRetry={onRetry}
        />
      )}
      <div className={styles.dates}>
        {dates.map((date) => {
          const summary = summaryFor(date);
          const loading = summaries.status === "loading";
          return (
            <button
              key={date}
              type="button"
              className={styles.dateCard}
              aria-pressed={selected === date}
              onClick={() => onSelect(date)}
            >
              <span className={styles.dateTop}>
                {dateLabel(date)}
                {selected === date && <span className={styles.selectedDateLabel}><Check size={18} aria-hidden="true" /><span className="sr-only">Selected</span></span>}
              </span>
              {loading ? (
                <span className={styles.dateCount}>Loading conditions…</span>
              ) : (
                <>
                  <BandPill band={summary.band} />
                  {summary.count > 0 && (
                    <BreakdownBar breakdown={summary.breakdown} />
                  )}
                  <span className={styles.dateCount}>
                    {summary.count}/{summary.total} sites assessed
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.dateFeedback}>
        <div role="status" aria-live="polite" aria-atomic="true">
          <strong>
            {dateLabel(selected, true)}
            {summaries.status === "ready" && ` · ${labels[current.band]}`}
          </strong>
          {waves.length > 0 || winds.length > 0 || rain !== null ? (
            <p className={styles.dateSignals}>
              {waves.length > 0 && <span><Waves size={16} />{range(waves)} m</span>}
              {winds.length > 0 && <span><Wind size={16} />{range(winds)} km/h</span>}
              {rain !== null && <span><CloudRain size={16} />{rain}% rain chance</span>}
            </p>
          ) : summaries.status === "ready" && !signalText ? (
            <p>No forecast values available for this date.</p>
          ) : null}
          {summaries.status === "ready" && current.count > 0 && (
            <p>
              {current.breakdown.more_favourable} more favourable ·{" "}
              {current.breakdown.mixed} mixed ·{" "}
              {current.breakdown.less_favourable} less favourable · from{" "}
              {current.count} of {current.total} sites
            </p>
          )}
        </div>
        <a href="#site-results">View sites <ArrowRight size={16} /></a>
      </div>
      <details className={styles.details}>
        <summary>How are these conditions assessed?</summary>
        {signalText && <p>Area daily maximum: {signalText}.</p>}
        {current.reasons.length > 0 && (
          <ul className={styles.dateReasons}>
            {current.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {sample ? (
          <>
            <p>
              Illustrative rule prototype-v1: wave height ≤ 0.8 m and wind ≤ 12 km/h
              → more favourable; wave height &gt; 1.5 m or wind &gt; 20 km/h → less
              favourable; otherwise mixed. The area band is the least favourable of
              assessable sites. It is not one area-wide measurement.
            </p>
            <p>
              These are demonstration thresholds, not validated diving guidance.
              Site values, units and rule reasons appear below. Nearby sites share
              sample provider cells and can have identical values.
            </p>
          </>
        ) : (
          <>
            <p>
              Each site is assessed from forecast wave height and wind speed. The
              rule version and the reason for each result appear on the site
              cards. The area band is the least favourable of assessable sites. It
              is not one area-wide measurement.
            </p>
            <p>
              Nearby sites can share a forecast grid cell and show identical
              values. Conditions are a planning aid, not dive clearance.
            </p>
          </>
        )}
      </details>
    </section>
  );
}
export function AreaOverview({ area }: { area: Area }) {
  const photo = surfaceImages[area];
  return (
    <figure className={styles.areaOverview}>
      <div className={styles.areaImage}>
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(max-width: 700px) 90vw, 800px"
        />
      </div>
      <figcaption>
        <strong>{photo.caption}</strong>
        <details>
          <summary>Photo credit & source</summary>
          <p>
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.credit}</a>
            {" · "}
            <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
            . Resized and displayed cropped. This regional photograph does not
            show the exact dive sites or current conditions.
          </p>
        </details>
      </figcaption>
    </figure>
  );
}

export function SiteCard({
  date,
  site,
  assessment,
  mode,
  selected,
  onToggle,
  onBrief,
}: {
  date: string;
  site: ReefSite;
  assessment: Assessment | null;
  mode: PlanningSource["mode"];
  selected: boolean;
  onToggle: () => void;
  onBrief: () => void;
}) {
  const photograph = site.images[0];
  return (
    <article className={styles.siteCard} data-selected={selected}>
      <div className={styles.siteImage}>
        <Image
          src={photograph.src}
          alt={photograph.alt}
          fill
          sizes="(max-width: 700px) 90vw, 350px"
        />
        <span className={styles.imageCaption}>
          Illustrative reef image
        </span>
        <button
          type="button"
          className={styles.selectSite}
          aria-label={`${selected ? "Remove" : "Add"} ${site.name} ${selected ? "from" : "to"} plan`}
          aria-pressed={selected}
          onClick={onToggle}
        >
          {selected ? <Check size={16} /> : "+"}
        </button>
      </div>
      <div className={styles.siteBody}>
        <span className={styles.siteLocation}>
          <MapPin size={13} />
          {site.publicAreaLabel}
        </span>
        <h3>{site.name}</h3>
        <p className={styles.siteForecastDate}>Conditions for {dateLabel(date)}</p>
        {assessment ? (
          <>
            <BandPill band={assessment.band} />
            <Signals assessment={assessment} />
            <p className={styles.siteReason}>{assessment.reason}</p>
          </>
        ) : (
          <p className={styles.siteReason} role="status">
            Loading conditions…
          </p>
        )}
        <details className={styles.details}>
          <summary>Site details & sources</summary>
          <p>{site.introduction}</p>
          <p>
            {site.experience.level} · {site.experience.explanation}
          </p>
          <a href={site.source.url} target="_blank" rel="noreferrer">
            {site.source.label} <ExternalLink size={12} />
          </a>
          {assessment && (
            <p>
              {forecastProvenance(assessment, mode === "sample")}. No exact
              underwater conditions inferred.
            </p>
          )}
          <a href={site.images[0].sourceUrl} target="_blank" rel="noreferrer">
            Image: {site.images[0].credit} · {site.images[0].license}
          </a>
        </details>
        <button type="button" className={styles.textButton} onClick={onBrief}>
          View reef-aware brief <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}
type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "no-facts" }
  | { status: "done"; view: BriefView };

export function BriefPanel({
  site,
  date,
  assessment,
  source,
  context,
}: {
  site: ReefSite;
  date: string;
  assessment: Assessment | null;
  source: PlanningSource;
  context: PlanningContext;
}) {
  const sample = source.mode === "sample";
  const [brief, setBrief] = useState<BriefState>({ status: "idle" });
  const { state: reefContext, retry: retryContext } = useAsyncData(
    () => source.publicContext(site, context),
    [source, site, context.today, context.scenario],
  );
  const contextAvailable =
    reefContext.status === "ready" && reefContext.data.available;
  const hasFacts = assessment !== null && assessment.waves !== null;
  async function generate() {
    if (!assessment || !hasFacts) {
      setBrief({ status: "no-facts" });
      return;
    }
    setBrief({ status: "loading" });
    try {
      setBrief({
        status: "done",
        view: await source.brief(site, date, assessment, context, contextAvailable),
      });
    } catch {
      setBrief({ status: "done", view: { status: "unavailable" } });
    }
  }
  return (
    <div className={styles.brief}>
      <h2>{site.name}</h2>
      <p>
        {dateLabel(date, true)} · {site.publicAreaLabel}
      </p>
      <section className={styles.briefFacts}>
        <h3>
          <Waves size={19} /> Forecast facts{sample ? " · sample data" : ""}
        </h3>
        {assessment ? (
          <>
            <BandPill band={assessment.band} />
            <Signals assessment={assessment} />
            <p>{assessment.reason}</p>
            <p className={styles.source}>
              {forecastProvenance(assessment, sample)}
            </p>
          </>
        ) : (
          <p role="status">Loading conditions…</p>
        )}
      </section>
      <section className={styles.briefFacts}>
        <h3>
          <MapPin size={19} /> Recent ReefCare context
        </h3>
        {reefContext.status === "loading" && (
          <p role="status">Loading reef context…</p>
        )}
        {reefContext.status === "error" && (
          <>
            <LoadError
              error={reefContext.error}
              fallback="Reef context could not be loaded. This does not mean there are no reef threats."
              onRetry={retryContext}
            />
          </>
        )}
        {reefContext.status === "ready" && !reefContext.data.available && (
          <p>{reefContext.data.note}</p>
        )}
        {reefContext.status === "ready" && reefContext.data.available && (
          <>
            {reefContext.data.headline && <p>{reefContext.data.headline}</p>}
            {reefContext.data.items.map((item) => (
              <p key={`${item.title}-${item.summary}`}>
                <strong>{item.title}</strong> {item.summary}
                {item.meta ? ` · ${item.meta}` : ""}
              </p>
            ))}
            <Link className={styles.textButton} href="/reef-threats">
              Know what to look for <ChevronRight size={15} />
            </Link>
            <small>{reefContext.data.note}</small>
          </>
        )}
      </section>
      <section className={styles.generated}>
        <h3>
          <Sparkles size={19} /> Planning brief
        </h3>
        <span className={styles.smallTag}>
          {sample ? "AI-generated format · simulated text" : "AI-generated text"}
        </span>
        {brief.status === "idle" ? (
          <>
            <p>
              Bring the condition facts and public reef context together in one
              short briefing.
            </p>
            <button
              className={styles.primary}
              type="button"
              onClick={generate}
              disabled={assessment === null}
            >
              <Sparkles size={17} /> {sample ? "Generate sample brief" : "Generate brief"}
            </button>
          </>
        ) : brief.status === "loading" ? (
          <p role="status">Writing your brief…</p>
        ) : brief.status === "no-facts" ? (
          <div role="status">
            <h4>Forecast information is missing</h4>
            <p>
              A current condition briefing cannot be generated for this date.
              Explore seasonal reference and site information instead.
            </p>
          </div>
        ) : brief.view.status === "unavailable" ? (
          <div role="status">
            <h4>Written brief temporarily unavailable</h4>
            <p>
              {sample
                ? "The simulated AI service failed. "
                : "The brief could not be written. "}
              Your source facts, site information and reef context remain
              available.
            </p>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setBrief({ status: "idle" })}
            >
              Try again
            </button>
          </div>
        ) : (
          <div role="status">
            {brief.view.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <small>{brief.view.footnote}</small>
          </div>
        )}
      </section>
      <details className={styles.details}>
        <summary>About this dive site</summary>
        <p>{site.introduction}</p>
        {site.preparation.map((item) => (
          <p key={item}>{item}</p>
        ))}
        <a href={site.source.url} target="_blank" rel="noreferrer">
          {site.source.label}
        </a>
      </details>
    </div>
  );
}

"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
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
export function Signals({ assessment }: { assessment: Assessment }) {
  return (
    <div className={styles.signals}>
      <span>
        <Waves size={17} />
        {assessment.waves === null ? "—" : `${assessment.waves.toFixed(1)} m`}
        <small>Wave height</small>
      </span>
      <span>
        <Wind size={17} />
        {assessment.wind === null ? "—" : `${assessment.wind} km/h`}
        <small>Wind speed</small>
      </span>
    </div>
  );
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
          <span className={styles.eyebrow}>THE BIGGER PICTURE</span>
          <h2 id="season-heading">A year around {area}</h2>
          <p>Explore the seasonal rhythm before choosing your dates.</p>
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
    };
  const current = summaryFor(selected);
  const waves = siteAssessments.flatMap((item) => item.waves === null ? [] : [item.waves]);
  const winds = siteAssessments.flatMap((item) => item.wind === null ? [] : [item.wind]);
  const range = (values: number[]) => Math.min(...values) === Math.max(...values)
    ? String(Math.min(...values))
    : `${Math.min(...values)}–${Math.max(...values)}`;
  return (
    <section className={styles.panel} aria-labelledby="dates-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>01 / CHOOSE YOUR DAY</span>
          <h2 id="dates-heading">Find your window</h2>
          <p>
            Compare forecast conditions across the area, then look closer at
            each site.
          </p>
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
                {selected === date && <span className={styles.selectedDateLabel}><Check size={14} />Selected</span>}
              </span>
              {loading ? (
                <span className={styles.dateCount}>Loading conditions…</span>
              ) : (
                <>
                  <BandPill band={summary.band} />
                  <span className={styles.dateCount}>
                    {summary.count} of {summary.total} sites assessable
                  </span>
                  {summary.count > 0 && (
                    <span className={styles.breakdown}>
                      {summary.breakdown.more_favourable} favourable ·{" "}
                      {summary.breakdown.mixed} mixed ·{" "}
                      {summary.breakdown.less_favourable} less favourable
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.dateFeedback}>
        <div role="status" aria-live="polite" aria-atomic="true">
          <strong>Showing conditions for {dateLabel(selected, true)}</strong>
          {summaries.status === "ready" && (
            <p>{labels[current.band]} · {current.count} of {current.total} sites assessable</p>
          )}
          {waves.length > 0 && winds.length > 0 ? (
            <p>Across assessable sites: waves {range(waves)} m · wind {range(winds)} km/h</p>
          ) : summaries.status === "ready" ? (
            <p>No forecast values available for this date.</p>
          ) : null}
        </div>
        <a href="#site-results">View sites for this day <ArrowRight size={16} /></a>
      </div>
      <details className={styles.details}>
        <summary>How are these conditions assessed?</summary>
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
        <p>A coastal view of the region. Individual dive sites are shown below.</p>
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
              {mode === "sample" ? "Sample forecast fixture" : "Forecast data"}{" "}
              · retrieval time {assessment.retrievedAt} · Rule{" "}
              {assessment.ruleVersion}. No exact underwater conditions inferred.
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
      <span className={styles.eyebrow}>YOUR REEF-AWARE BRIEF</span>
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
              {sample ? "Synthetic provider fixture" : "Forecast provider"} ·{" "}
              {assessment.retrievedAt} · {assessment.ruleVersion}
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

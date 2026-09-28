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
import {
  assess,
  dateLabel,
  daySummary,
  labels,
  months,
  sitesIn,
  type Area,
  type Assessment,
  type Band,
  type Scenario,
} from "./planning-data";
import styles from "./planning.module.css";
import { surfaceImages } from "./surface-images";

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
export function Seasonality({ area }: { area: Area }) {
  const [month, setMonth] = useState(8);
  const season = (index: number) =>
    index === 9
      ? "unreviewed"
      : [10, 11, 0, 1].includes(index)
        ? "monsoon"
        : [2, 8].includes(index)
          ? "transition"
          : "typical";
  const state = season(month);
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
      <div className={styles.months}>
        {months.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setMonth(index)}
            aria-pressed={month === index}
            className={styles.month}
            data-season={season(index)}
          >
            <span>{label}</span>
            <span className={styles.seasonBar} />
            <small>
              {season(index) === "monsoon"
                ? "Monsoon"
                : season(index) === "transition"
                  ? "Transition"
                  : season(index) === "unreviewed"
                    ? "No data"
                    : "Typical"}
            </small>
          </button>
        ))}
      </div>
      <div className={styles.seasonDetail}>
        <Info size={19} />
        <div>
          <strong>
            {months[month]} ·{" "}
            {state === "monsoon"
              ? "Northeast monsoon reference"
              : state === "unreviewed"
                ? "Reviewed guidance unavailable"
                : state === "transition"
                  ? "A changing season"
                  : "Generally more favourable seasonal pattern"}
          </strong>
          <p>
            {state === "unreviewed"
              ? "This prototype demonstrates a month without reviewed guidance. No seasonal pattern is inferred."
              : state === "monsoon"
                ? "The sample calendar illustrates potentially rougher seas and changing operator schedules. Seasonal patterns do not predict conditions on a particular date."
                : "This illustrative seasonal entry is reference information, not a forecast. Confirm current conditions and access with local operators and authorities."}
          </p>
        </div>
      </div>
      <p className={styles.source}>
        Source: synthetic seasonal reference for prototype review · Basis:
        example east-coast seasonal pattern · Fixture reviewed 27 Sep 2026 · Not
        a live feed or operational advice.
      </p>
    </section>
  );
}
export function DateComparison({
  dates,
  area,
  today,
  scenario,
  selected,
  onSelect,
}: {
  dates: string[];
  area: Area;
  today: string;
  scenario: Scenario;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const current = daySummary(selected, area, today, scenario);
  const conditions = sitesIn(area).map((_, index) => assess(selected, area, today, scenario, index));
  const waves = conditions.flatMap((item) => item.waves === null ? [] : [item.waves]);
  const winds = conditions.flatMap((item) => item.wind === null ? [] : [item.wind]);
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
        <span className={styles.smallTag}>7-day sample forecast</span>
      </div>
      <div className={styles.dates}>
        {dates.map((date) => {
          const summary = daySummary(date, area, today, scenario);
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
            </button>
          );
        })}
      </div>
      <div className={styles.dateFeedback}>
        <div role="status" aria-live="polite" aria-atomic="true">
          <strong>Showing conditions for {dateLabel(selected, true)}</strong>
          <p>{labels[current.band]} · {current.count} of {current.total} sites assessable</p>
          {waves.length > 0 && winds.length > 0 ? (
            <p>Across assessable sites: waves {range(waves)} m · wind {range(winds)} km/h</p>
          ) : <p>No forecast values available for this date.</p>}
        </div>
        <a href="#site-results">View sites for this day <ArrowRight size={16} /></a>
      </div>
      <details className={styles.details}>
        <summary>How are these conditions assessed?</summary>
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
  selected,
  onToggle,
  onBrief,
}: {
  date: string;
  site: ReefSite;
  assessment: Assessment;
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
        <BandPill band={assessment.band} />
        <Signals assessment={assessment} />
        <p className={styles.siteReason}>{assessment.reason}</p>
        <details className={styles.details}>
          <summary>Site details & sources</summary>
          <p>{site.introduction}</p>
          <p>
            {site.experience.level} · {site.experience.explanation}
          </p>
          <a href={site.source.url} target="_blank" rel="noreferrer">
            {site.source.label} <ExternalLink size={12} />
          </a>
          <p>
            Sample forecast fixture · retrieval time {assessment.retrievedAt} ·
            Rule {assessment.ruleVersion}. No exact underwater conditions
            inferred.
          </p>
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
export function BriefPanel({
  site,
  date,
  area,
  today,
  scenario,
}: {
  site: ReefSite;
  date: string;
  area: Area;
  today: string;
  scenario: Scenario;
}) {
  const [generated, setGenerated] = useState(false);
  const assessment = assess(
    date,
    area,
    today,
    scenario,
    sitesIn(area).findIndex((item) => item.id === site.id),
  );
  const hasFacts = assessment.waves !== null;
  const noContext = scenario === "context";
  return (
    <div className={styles.brief}>
      <span className={styles.eyebrow}>YOUR REEF-AWARE BRIEF</span>
      <h2>{site.name}</h2>
      <p>
        {dateLabel(date, true)} · {site.publicAreaLabel}
      </p>
      <section className={styles.briefFacts}>
        <h3>
          <Waves size={19} /> Forecast facts · sample data
        </h3>
        <BandPill band={assessment.band} />
        <Signals assessment={assessment} />
        <p>{assessment.reason}</p>
        <p className={styles.source}>
          Synthetic provider fixture · {assessment.retrievedAt} ·{" "}
          {assessment.ruleVersion}
        </p>
      </section>
      <section className={styles.briefFacts}>
        <h3>
          <MapPin size={19} /> Recent ReefCare context
        </h3>
        {noContext ? (
          <p>
            No public ReefCare context is currently available. This does not
            mean there are no reef threats.
          </p>
        ) : (
          <>
            <p>
              <strong>3 assessed observations</strong> in the example 30-day
              window: 2 marine debris and 1 coral bleaching. Assessment state:
              evidence accepted, not field verification.
            </p>
            <p>
              1 publishable monitoring update · {dateLabel(today)}. These are
              fictional demonstration records, not actual activity at this site.
            </p>
            <Link className={styles.textButton} href="/reef-threats">
              Know what to look for <ChevronRight size={15} />
            </Link>
          </>
        )}
        <small>
          Generalised public summary. Private reports, identities and precise
          report locations are excluded.
        </small>
      </section>
      <section className={styles.generated}>
        <h3>
          <Sparkles size={19} /> Planning brief
        </h3>
        <span className={styles.smallTag}>
          AI-generated format · simulated text
        </span>
        {!generated ? (
          <>
            <p>
              Bring the condition facts and public reef context together in one
              short briefing.
            </p>
            <button
              className={styles.primary}
              type="button"
              onClick={() => setGenerated(true)}
            >
              <Sparkles size={17} /> Generate sample brief
            </button>
          </>
        ) : scenario === "ai" ? (
          <div role="status">
            <h4>Written brief temporarily unavailable</h4>
            <p>
              The simulated AI service failed. Your source facts, site
              information and reef context remain available.
            </p>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setGenerated(false)}
            >
              Try again
            </button>
          </div>
        ) : !hasFacts ? (
          <div role="status">
            <h4>Forecast information is missing</h4>
            <p>
              A current condition briefing cannot be generated for this date.
              Explore seasonal reference and site information instead.
            </p>
          </div>
        ) : (
          <div role="status">
            <p>
              The sample forecast for {site.name} shows {assessment.waves} m
              wave height and {assessment.wind} km/h wind, giving{" "}
              {labels[assessment.band].toLowerCase()} forecast conditions under
              the illustrative rule.
            </p>
            <p>
              {noContext
                ? "Public ReefCare context is unavailable; no conclusion about reef threats can be drawn."
                : "The sample reef context includes assessed debris and bleaching observations. Familiarise yourself with these threats, keep your equipment clear of coral and observe without disturbing the reef."}
            </p>
            <p>
              Confirm the day’s conditions, site access and your experience
              requirements with a local operator. This brief does not determine
              whether a dive should proceed.
            </p>
            <small>
              Sample text generated from local fixtures · Not a connected AI
              service
            </small>
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

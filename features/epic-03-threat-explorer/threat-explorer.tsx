"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Camera, ChevronRight, Info, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { recognitionNotice, spotTheThreatExamples, threatExplorerItems, type ThreatExplorerCode } from "./threat-explorer-data";
import styles from "./threat-explorer.module.css";

function Arrow({ direction }: { direction: "left" | "right" }) {
  const Icon = direction === "left" ? ArrowLeft : ArrowRight;
  return <Icon size={18} aria-hidden="true" />;
}

export function ThreatExplorer({ initialThreat }: { initialThreat?: ThreatExplorerCode }) {
  const { status, user } = useAuth();
  const initialIndex = initialThreat
    ? threatExplorerItems.findIndex((threat) => threat.code === initialThreat)
    : 0;
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const selected = threatExplorerItems[selectedIndex];
  const example = spotTheThreatExamples[exampleIndex];

  const selectThreat = (index: number) => {
    setSelectedIndex(index);
  };

  const nextExample = () => {
    setExampleIndex((exampleIndex + 1) % spotTheThreatExamples.length);
  };

  const reportHref = (code: ThreatExplorerCode | "unsure") => {
    const categoryCode = code === "physical_reef_damage" ? "physical_damage" : code;
    const destination = `/report-a-reef?threat=${categoryCode}`;
    return status === "authenticated" && user?.role === "observer"
      ? destination
      : `/login?next=${encodeURIComponent(destination)}`;
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Reef threats</h1>
          <p>Meet the four threats facing Malaysia’s reefs. Know the signs. Observe safely.</p>
          <p className={styles.recognitionNotice}><Info size={14} aria-hidden="true" />{recognitionNotice}</p>
        </div>
      </header>

      <div className={styles.main}>
        <section className={styles.explorer} id="threats" aria-labelledby="threats-heading">
          <div className={styles.sectionHeader}>
            <h2 id="threats-heading">Explore a threat</h2>
            <div className={styles.carouselControls}>
              <p aria-live="polite">{selectedIndex + 1} of {threatExplorerItems.length}</p>
              <button type="button" aria-label="Previous threat" disabled={selectedIndex === 0} onClick={() => selectThreat(selectedIndex - 1)}><Arrow direction="left" /></button>
              <button type="button" aria-label="Next threat" disabled={selectedIndex === threatExplorerItems.length - 1} onClick={() => selectThreat(selectedIndex + 1)}><Arrow direction="right" /></button>
            </div>
          </div>

          <div className={styles.cardRail} role="group" aria-label="Supported reef threats">
            {threatExplorerItems.map((threat, index) => (
              <button
                className={styles.threatCard}
                key={threat.code}
                type="button"
                aria-label={`Explore ${threat.label}`}
                aria-pressed={selectedIndex === index}
                onClick={() => selectThreat(index)}
              >
                <Image src={threat.image} alt="" fill sizes="(max-width: 640px) 45vw, 280px" />
                <span className={styles.cardShade} aria-hidden="true" />
                <span className={styles.cardNumber}>{threat.number}</span><strong>{threat.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.detail} aria-live="polite" aria-labelledby="selected-threat-heading">
          <div className={styles.detailGallery} aria-label={`${selected.label} visual examples`}>
            {selected.examples.map((item, index) => (
              <figure className={styles.detailImage} key={item.image}>
                <Image src={item.image} alt={item.alt} fill sizes="(max-width: 640px) 50vw, 22vw" priority={selectedIndex === 0 && index === 0} />
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <div className={styles.detailCopy}>
            <h2 id="selected-threat-heading">{selected.label}</h2><p className={styles.lead}>{selected.summary}</p>
            <div className={styles.factGrid}>
              <div><h3>What it looks like</h3><p>{selected.looksLike}</p></div>
              <div><h3>Why it matters</h3><p>{selected.impact}</p><a className={styles.factSource} href={selected.impactSource.url} target="_blank" rel="noreferrer">Fact source: {selected.impactSource.label}<ExternalLink size={12} aria-hidden="true" /></a></div>
            </div>
            <div className={styles.cues}><h3>Recognition cues</h3><ol>{selected.recognitionCues.map((cue, index) => <li key={cue}><span>0{index + 1}</span>{cue}</li>)}</ol></div>
            <aside className={styles.evidence} aria-label={`What to record for ${selected.label}`}><Camera size={20} aria-hidden="true" /><div><strong>What to record</strong><p>{selected.evidenceGuidance}</p></div></aside>
            <aside className={styles.safety}><ShieldCheck size={20} aria-hidden="true" /><div><strong>Observe safely</strong><p>{selected.safety}</p></div></aside>
            <Link className={styles.primaryAction} href={reportHref(selected.code)}>Report this threat <Arrow direction="right" /></Link>
          </div>
        </section>

        <section className={styles.quiz} aria-labelledby="spot-heading">
          <div className={styles.quizIntro}><h2 id="spot-heading">Spot the threat</h2><p>Small details reveal what is happening on a reef.</p></div>
          <div className={styles.quizPanel}>
            <figure className={styles.quizImage}>
              <Image src={example.image} alt={example.imageAlt} fill sizes="(max-width: 900px) 100vw, 52vw" />
            </figure>
            <div className={styles.quizCopy}>
              <div className={styles.answers} role="group" aria-label="Visual threat examples">{spotTheThreatExamples.map((item, index) => <button aria-pressed={exampleIndex === index} key={item.threatCode} type="button" onClick={() => setExampleIndex(index)}>{threatExplorerItems.find((threat) => threat.code === item.threatCode)?.label}<ChevronRight size={18} aria-hidden="true" /></button>)}</div>
              <div className={styles.feedback} role="status">
                <h3>{example.prompt}</h3>
                <p>{example.explanation}</p>
                <div className={styles.feedbackActions}>
                  <button type="button" className={styles.nextExample} onClick={nextExample}>
                    Next example <Arrow direction="right" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <details className={styles.photoCredits}>
          <summary>Image sources</summary>
          <p>Illustrations are generated for ReefCare, including the healthy-versus-affected comparisons above; they show recognition cues and are not photographs of recorded incidents. Impact facts are linked to their NOAA sources above.</p>
        </details>

        <section className={styles.unsure}>
          <h2>Not sure what you saw?</h2>
          <p>Share what you saw without guessing. A clear photo, place and simple description are enough to begin.</p>
          <Link className={styles.lightAction} href={reportHref("unsure")}>I’m not sure what I saw <Arrow direction="right" /></Link>
        </section>
      </div>
    </div>
  );
}

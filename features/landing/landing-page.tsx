"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "@/features/epic-01-access/auth-context";
import { PhotoCreditLine } from "@/features/shared/photo-credit-line";
import styles from "./landing-page.module.css";

const heroPhoto = "/images/threats/open/bleaching-samoa.webp";

const threats = [
  { name: "Ghost fishing gear", code: "ghost_gear", image: "/images/threats/open/net-reef.webp", alt: "A lost fishing net draped over coral on a reef slope", text: "Lost nets, lines, traps or ropes caught on the reef." },
  { name: "Coral bleaching", code: "coral_bleaching", image: "/images/threats/open/bleaching-acropora.webp", alt: "A bleached white branching coral colony in blue water", text: "Coral that has turned unusually pale or white." },
  { name: "Marine debris", code: "marine_debris", image: "/images/threats/open/debris-indonesia.webp", alt: "A plastic wrapper caught on coral", text: "Human-made waste resting on or tangled in the reef." },
  { name: "Physical reef damage", code: "physical_reef_damage", image: "/images/threats/open/broken-corals.webp", alt: "Broken coral fragments heaped on the reef floor", text: "Coral that has been freshly broken, crushed or scraped." },
] as const;

const causticMesh = [
  "M0 62C35 42 68 45 104 74C140 102 174 83 206 58C244 29 284 47 322 78C360 109 398 85 480 62",
  "M0 166C38 140 70 143 102 174C135 206 170 185 203 153C236 121 276 137 310 172C344 207 391 188 480 166",
  "M0 272C39 242 76 245 110 278C143 310 176 292 214 259C250 228 286 239 326 275C364 309 403 296 480 272",
  "M86 0C70 28 75 48 104 74C131 99 120 134 102 174C84 214 88 244 110 278C124 299 104 323 86 340",
  "M202 0C220 24 227 37 206 58C186 80 180 123 203 153C228 185 234 224 214 259C194 291 195 318 202 340",
  "M326 0C296 30 296 54 322 78C345 103 337 142 310 172C282 204 295 246 326 275C350 298 339 320 326 340",
].join("");

function CausticLayer({ id, className, seed }: { id: string; className: string; seed: number }) {
  const patternId = `${id}-pattern`;
  const filterId = `${id}-filter`;

  return (
    <svg className={className} viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id={patternId} width="480" height="340" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#7bc4c1" strokeLinecap="round" strokeLinejoin="round">
            <path d={causticMesh} strokeOpacity=".13" strokeWidth="8" />
            <path d={causticMesh} strokeOpacity=".46" strokeWidth="2.1" />
          </g>
        </pattern>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed={seed} result="waterNoise" />
          <feDisplacementMap in="SourceGraphic" in2="waterNoise" scale="28" xChannelSelector="R" yChannelSelector="B" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>
      <rect width="1400" height="700" fill={`url(#${patternId})`} filter={`url(#${filterId})`} />
    </svg>
  );
}

function WaterCaustics({ id }: { id: string }) {
  return (
    <div className={styles.waterCaustics} aria-hidden="true">
      <CausticLayer id={`${id}-one`} className={styles.causticLayerOne} seed={7} />
      <CausticLayer id={`${id}-two`} className={styles.causticLayerTwo} seed={13} />
    </div>
  );
}

function useScrollReveal() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      section.classList.add(styles.isVisible);
      return;
    }

    section.classList.add(styles.motionReady);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        section.classList.add(styles.isVisible);
        observer.disconnect();
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return sectionRef;
}

export function LandingPage() {
  const { status, user } = useAuth();
  const threatSectionRef = useScrollReveal();
  const processSectionRef = useScrollReveal();
  const signedIn = status === "authenticated";
  const reportHref = signedIn ? "/report-a-reef" : `/login?next=${encodeURIComponent("/report-a-reef")}`;
  const primaryAction = user?.role === "case_coordinator"
    ? { href: "/coordinator/report-queue", label: "Open report intake" }
    : user?.role === "system_administrator"
      ? { href: "/admin/users", label: "Manage users and access" }
      : { href: reportHref, label: "Report what you saw" };

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <WaterCaustics id="hero-caustics" />
        <div className={styles.heroCopy}>
          <h1 id="hero-heading">Turn what you saw underwater into a useful reef report.</h1>
          <p className={styles.lead}>Divers and reef observers use ReefCare MY to record potential threats on Malaysia&apos;s reefs, keep sensitive locations private and follow what happens next. No scientific training needed.</p>
          <div className={styles.heroControls}>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} href={primaryAction.href}>{primaryAction.label}</Link>
              <Link className={styles.secondaryButton} href="/reef-threats">Learn the four threats</Link>
            </div>
            {!signedIn && status !== "loading" && (
              <p className={styles.signInPrompt}>New to ReefCare? <Link href={`/register?next=${encodeURIComponent("/report-a-reef")}`}>Create a free observer account</Link>.</p>
            )}
          </div>
        </div>
        <figure className={styles.visualPanel}>
          <div className={styles.photoFrame}>
            <Image
              className={styles.reefPhoto}
              src={heroPhoto}
              alt="A bleached white table coral growing beside a healthy brown colony"
              width={1440}
              height={1080}
              priority
              sizes="(max-width: 1060px) 90vw, 45vw"
            />
            <span className={styles.labelBleached} aria-hidden="true">Bleached</span>
            <span className={styles.labelHealthy} aria-hidden="true">Healthy</span>
          </div>
          <figcaption className={styles.photoCaption}>
            <PhotoCreditLine images={[heroPhoto]} lead="Bleaching beside healthy coral, American Samoa. Photo:" />
          </figcaption>
        </figure>
      </section>

      <section ref={threatSectionRef} className={`${styles.section} ${styles.threatSection}`} aria-labelledby="threat-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="threat-heading">Four threats worth reporting</h2>
            <p>Spot one on a dive? Photograph it from a safe distance, then report it.</p>
          </div>
          <Link className={styles.textLink} href="/reef-threats">How to recognise each one <span aria-hidden="true">→</span></Link>
        </div>
        <ul className={styles.threatGrid}>
          {threats.map((threat) => (
            <li key={threat.code}>
              <Link className={styles.threatCard} href={`/reef-threats?threat=${threat.code}`}>
                <span className={styles.threatImage}>
                  <Image src={threat.image} alt={threat.alt} fill sizes="(max-width: 760px) 92vw, (max-width: 1060px) 45vw, 22vw" />
                </span>
                <span className={styles.threatBody}>
                  <h3>{threat.name}</h3>
                  <span>{threat.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <PhotoCreditLine className={styles.imageNote} images={threats.map((threat) => threat.image)} lead="Example photos from reefs worldwide, not ReefCare reports:" />
      </section>

      <section ref={processSectionRef} className={styles.processSection} aria-labelledby="process-heading">
        <div className={styles.processIntro}>
          <h2 id="process-heading">From your dive to a traceable report</h2>
          <p>Anyone can learn the threats. Sign in as an observer to submit a report and follow it.</p>
        </div>
        <ol className={styles.steps}>
          <li><span aria-hidden="true">1</span><div><h3>Say what you saw</h3><p>Pick the closest threat, or &ldquo;not sure&rdquo;. Add photos, the date and a few words.</p></div></li>
          <li><span aria-hidden="true">2</span><div><h3>Add where it was</h3><p>The dive site is enough. Exact points stay private to you and the coordinator.</p></div></li>
          <li><span aria-hidden="true">3</span><div><h3>Submit and keep the reference</h3><p>Your report gets an ID and goes to a case coordinator for review.</p></div></li>
          <li><span aria-hidden="true">4</span><div><h3>Follow honest updates</h3><p>My Reports shows the status and outcome, without promising action that has not happened.</p></div></li>
        </ol>
      </section>

      <section className={styles.closing} aria-labelledby="closing-heading">
        <div className={styles.closingInner}>
          <div>
            <h2 id="closing-heading">Seen something on your last dive?</h2>
            <p>A photo, a date and a few words are enough to start. Your draft is saved on your device until you submit.</p>
          </div>
          <div className={styles.closingActions}>
            <Link className={styles.lightButton} href={reportHref}>Report what you saw</Link>
            <Link className={styles.ghostLink} href="/plan-a-dive">Plan a reef-aware dive <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

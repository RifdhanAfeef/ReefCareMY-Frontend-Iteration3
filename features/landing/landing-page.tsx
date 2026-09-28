"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "@/features/epic-01-access/auth-context";
import styles from "./landing-page.module.css";

const threats = [
  { name: "Ghost fishing gear", code: "ghost_gear", icon: "/images/threats/ghost-fishing-gear-icon.png", text: "Lost nets, lines, traps or ropes affecting reef life." },
  { name: "Coral bleaching", code: "coral_bleaching", icon: "/images/threats/coral-bleaching-icon-v2.png", text: "Unusually pale or white coral across a colony or reef area." },
  { name: "Marine debris", code: "marine_debris", icon: "/images/threats/marine-debris-icon.png", text: "Human-made waste resting on or interacting with the reef." },
  { name: "Physical reef damage", code: "physical_reef_damage", icon: "/images/threats/physical-reef-damage-icon-v2.png", text: "Recently broken, crushed or scraped coral." },
] as const;

function ThreatIcon({ src }: { src: (typeof threats)[number]["icon"] }) {
  return (
    <span className={styles.threatIcon} aria-hidden="true">
      <Image src={src} alt="" width={40} height={40} />
    </span>
  );
}

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
  const processSectionRef = useScrollReveal();
  const threatSectionRef = useScrollReveal();
  const signedIn = status === "authenticated";
  const signedInDestination = user?.role === "case_coordinator"
    ? { href: "/coordinator/report-queue", label: "Open report intake" }
    : user?.role === "system_administrator"
      ? { href: "/admin/users", label: "Manage users and access" }
      : { href: "/report-a-reef", label: "Start a reef report" };
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <WaterCaustics id="hero-caustics" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Community reef observation for Malaysia</p>
          <h1>Turn what you saw underwater into a useful reef report.</h1>
          <p className={styles.lead}>ReefCare MY helps divers and reef observers document potential threats, protect sensitive locations and follow what happens after submission without needing scientific expertise.</p>
          <div className={styles.heroControls}>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} href="/reef-threats">Explore reef threats</Link>
              {signedIn && (
                <Link className={styles.secondaryButton} href={signedInDestination.href}>{signedInDestination.label}</Link>
              )}
            </div>
            {!signedIn && status !== "loading" && (
              <p className={styles.signInPrompt}>Already registered? <Link href="/login">Log in to start or continue a report</Link>.</p>
            )}
          </div>
        </div>
        <div className={styles.visualPanel}>
          <Image
            className={styles.reefPhoto}
            src="/images/reef-photo-2.jpg"
            alt="A comparison of bleached coral and a healthy colourful coral reef"
            width={1168}
            height={784}
            priority
            sizes="(max-width: 1060px) 90vw, 45vw"
          />
        </div>
      </section>

      <section ref={processSectionRef} className={styles.processSection} aria-labelledby="process-heading">
        <div className={styles.processIntro}><p className={styles.eyebrow}>A clear reporting journey</p><h2 id="process-heading">From observation to a traceable report</h2><p>You can learn without an account. Sign in as a Registered Observer to create, submit and track a report.</p></div>
        <ol className={styles.steps}>
          <li><span>1</span><div><h3>Check the guidance</h3><p>Choose the closest threat and observe without touching or disturbing the reef.</p></div></li>
          <li><span>2</span><div><h3>Record what you saw</h3><p>Add photographs, date and time, a short description and safe location details.</p></div></li>
          <li><span>3</span><div><h3>Submit and keep the reference</h3><p>Your report receives a traceable ID and enters the Case Coordinator queue.</p></div></li>
          <li><span>4</span><div><h3>Follow honest updates</h3><p>My Reports shows the status and recorded outcome without promising external action.</p></div></li>
        </ol>
      </section>

      <section ref={threatSectionRef} className={`${styles.section} ${styles.threatSection}`} aria-labelledby="threat-heading">
        <WaterCaustics id="threat-caustics" />
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Supported observations</p><h2 id="threat-heading">Four reef threats you can document</h2></div><Link className={styles.textLink} href="/reef-threats">Open Reef Threat Explorer <span aria-hidden="true">→</span></Link></div>
        <div className={styles.threatGrid}>{threats.map((threat) => <Link className={styles.threatCard} href={`/reef-threats?threat=${threat.code}`} key={threat.name} aria-label={`Explore ${threat.name}`}><div className={styles.threatTitle}><ThreatIcon src={threat.icon} /><h3>{threat.name}</h3></div><p>{threat.text}</p><span className={styles.cardLink}>Explore threat <span className={styles.cardArrow} aria-hidden="true">→</span></span></Link>)}</div>
      </section>

    </div>
  );
}

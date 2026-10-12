"use client";

import Image from "next/image";
import { ChevronsLeftRight } from "lucide-react";
import { useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./coral-comparison.module.css";

export function CoralComparison({ className }: { className?: string }) {
  const [position, setPosition] = useState(50);
  const input = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const revealStyle = { "--reveal": `${position}%` } as CSSProperties;

  function moveDivider(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    setPosition(Math.round(Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))));
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    input.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    moveDivider(event);
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return <figure className={`${styles.comparison} ${className ?? ""}`}>
    <div className={styles.frame} style={revealStyle} onPointerDown={startDrag}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(event); }}
      onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <div className={styles.imageLayer}>
        <Image src="/images/landing/coral-bleached-illustration.webp"
          alt="Illustration of a branching coral colony with pale white, bleached tissue"
          fill priority sizes="(max-width: 1060px) 90vw, 45vw" draggable={false} />
        <span className={`${styles.label} ${styles.bleachedLabel}`} aria-hidden="true">Bleached</span>
      </div>
      <div className={`${styles.imageLayer} ${styles.healthyLayer}`}>
        <Image src="/images/landing/coral-healthy-illustration.webp"
          alt="The same coral colony with its healthy brown and pink colour"
          fill priority sizes="(max-width: 1060px) 90vw, 45vw" draggable={false} />
        <span className={`${styles.label} ${styles.healthyLabel}`} aria-hidden="true">Healthy</span>
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.handle} aria-hidden="true"><ChevronsLeftRight size={24} /></span>
      <input ref={input} className={styles.range} type="range" min={0} max={100} step={1}
        value={position} onChange={(event) => setPosition(Number(event.target.value))}
        aria-label="Compare healthy and bleached coral" aria-describedby={helpId}
        aria-valuetext={`${position}% healthy coral, ${100 - position}% bleached coral`} />
    </div>
    <figcaption className={styles.caption}>
      <p id={helpId}>Drag to compare healthy and bleached coral.</p>
    </figcaption>
  </figure>;
}

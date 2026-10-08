"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./table-viewport.module.css";

type TableViewportProps = {
  children: ReactNode;
  className?: string;
  label: string;
};

function readScrollState(viewport: HTMLDivElement) {
  const overflow = viewport.scrollWidth > viewport.clientWidth + 1;
  return {
    overflow,
    left: overflow && viewport.scrollLeft > 1,
    right: overflow && viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
  };
}

export function TableViewport({ children, className, label }: TableViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ overflow: false, left: false, right: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setScrollState(readScrollState(viewport));
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(viewport);
    if (viewport.firstElementChild) observer?.observe(viewport.firstElementChild);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [children]);

  function move(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft += direction * Math.max(180, viewport.clientWidth * 0.7);
    setScrollState(readScrollState(viewport));
  }

  return <div className={styles.container}>
    {scrollState.overflow && <div className={styles.controls} aria-label={`${label} column controls`}>
      <span>More columns are available</span>
      <button type="button" onClick={() => move(-1)} disabled={!scrollState.left} aria-label={`Previous ${label} columns`}>←</button>
      <button type="button" onClick={() => move(1)} disabled={!scrollState.right} aria-label={`Next ${label} columns`}>→</button>
    </div>}
    <div ref={viewportRef} className={className} role="region" aria-label={label} tabIndex={0}
      onScroll={(event) => setScrollState(readScrollState(event.currentTarget))}>
      {children}
    </div>
  </div>;
}

import type { ReactNode } from "react";
import styles from "./image-sources.module.css";

/** Native disclosure keeps photo credits available on every screen size. */
export function ImageSources({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <details className={`${styles.sources}${className ? ` ${className}` : ""}`}>
      <summary>Image sources</summary>
      <div className={styles.content}>{children}</div>
    </details>
  );
}

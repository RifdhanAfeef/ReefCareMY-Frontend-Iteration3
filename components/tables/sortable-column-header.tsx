import type { SortDirection } from "./table-sort";
import styles from "./sortable-column-header.module.css";

export function SortableColumnHeader({ label, direction, onSort, nextDirection = "ascending", detail, displayLabel }: {
  label: string;
  direction?: SortDirection;
  onSort: () => void;
  nextDirection?: SortDirection;
  detail?: string;
  displayLabel?: string;
}) {
  const next = direction === "ascending" ? "descending" : direction === "descending" ? "ascending" : nextDirection;
  return <th scope="col" aria-sort={direction ?? "none"}>
    <button type="button" className={styles.button} onClick={onSort} aria-label={`Sort by ${label}`}
      title={`Sort ${label}${detail ? ` ${detail}` : ""} ${next === "ascending" ? "ascending" : "descending"}`}>
      <span>{displayLabel ?? label}</span><span className={styles.indicator} aria-hidden="true">{direction === "ascending" ? "↑" : direction === "descending" ? "↓" : "↕"}</span>
    </button>
  </th>;
}

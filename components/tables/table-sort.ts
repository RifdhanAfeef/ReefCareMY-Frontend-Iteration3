export type SortDirection = "ascending" | "descending";
export type TableSort<Key extends string> = { key: Key; direction: SortDirection };
export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function nextTableSort<Key extends string>(current: TableSort<Key> | null, key: Key, first: SortDirection = "ascending"): TableSort<Key> {
  return { key, direction: current?.key === key
    ? current.direction === "ascending" ? "descending" : "ascending"
    : first };
}

export function compareSortValues(left: SortValue, right: SortValue, direction: SortDirection) {
  const missing = (value: SortValue) => value == null || value === "" || (typeof value === "number" && !Number.isFinite(value));
  // Missing values remain at the end in either direction.
  if (missing(left)) return missing(right) ? 0 : 1;
  if (missing(right)) return -1;
  const difference = typeof left === "number" && typeof right === "number"
    ? left - right : collator.compare(String(left), String(right));
  return direction === "ascending" ? difference : -difference;
}

export function sortTableRows<Row, Key extends string>(rows: readonly Row[], sort: TableSort<Key> | null, value: (row: Row, key: Key) => SortValue): Row[] {
  if (!sort) return [...rows];
  // Array.sort is stable; equal values retain the existing report order.
  return [...rows].sort((left, right) => compareSortValues(value(left, sort.key), value(right, sort.key), sort.direction));
}

export function prioritySortValue(priority?: string | null) {
  return ({ low: 1, medium: 2, high: 3 } as Record<string, number>)[priority?.toLowerCase() ?? ""] ?? null;
}

export function dateSortValue(value?: string | null) {
  return value ? Date.parse(value) : null;
}

// Settings sections: ids are part of the deep-link contract (?section=<id>). Pure helpers, no DOM access.

export const SECTION_IDS = ["roots", "tracked", "discovered", "scanning", "agents", "shared-config"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const PARAM = "section";

/** The section a query string asks for, if it is one of the sections on the page. */
export function parseSection<T extends string>(query: string, known: readonly T[]): T | undefined {
  const value = new URLSearchParams(query).get(PARAM);
  return known.find((id) => id === value);
}

/** `query` with the section set, keeping every other parameter. The first section is the default and is not written. */
export function serializeSection(query: string, id: string | undefined, first?: string): string {
  const params = new URLSearchParams(query);
  if (id === undefined || id === first) params.delete(PARAM);
  else params.set(PARAM, id);
  const out = params.toString();
  return out ? `?${out}` : "";
}

/**
 * Where the narrow-screen navigation row has to scroll (horizontally) so that an entry is fully visible: unchanged when
 * it already is, otherwise the smallest shift that reveals it. An entry wider than the row is aligned to its start.
 * Deliberately not `scrollIntoView`: that also scrolls the page, which would drag it back to a navigation that has
 * scrolled out of view.
 */
export function rowScrollLeft(row: { scrollLeft: number; clientWidth: number }, entry: { offsetLeft: number; offsetWidth: number }): number {
  const start = entry.offsetLeft;
  const end = entry.offsetLeft + entry.offsetWidth;
  if (start < row.scrollLeft || entry.offsetWidth > row.clientWidth) return Math.max(0, start);
  if (end > row.scrollLeft + row.clientWidth) return Math.max(0, end - row.clientWidth);
  return row.scrollLeft;
}

export interface SectionRect {
  id: string;
  /** Distance from the top of the scroll view to the top of the section; negative once scrolled past. */
  top: number;
}

/** A section counts as "at the top" once its start is within this many pixels of the top of the view. */
export const CURRENT_LINE_PX = 96;

/**
 * The section occupying the top of the view: the last one whose start has reached the top band. At the end of the
 * scroll range it is the last section, which may be too short to ever reach the top.
 */
export function currentSection(rects: SectionRect[], atEnd: boolean): string | undefined {
  if (rects.length === 0) return undefined;
  if (atEnd) return rects[rects.length - 1].id;
  let current = rects[0].id;
  for (const rect of rects) {
    if (rect.top <= CURRENT_LINE_PX) current = rect.id;
  }
  return current;
}

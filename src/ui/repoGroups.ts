// Repository grouping and colours for the board (group-changes-by-repo design D2, D5).
// Pure helpers: a repository contributes a hue only; the theme supplies lightness and chroma in CSS.

const SLOTS = 24;
const SLOT_DEGREES = 360 / SLOTS;
/** Coprime with SLOTS, so probing reaches every slot and lands a displaced repo ~105° away. */
const PROBE_STRIDE = 7;

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Assign every repository id a hue (0–345, multiples of 15). Deterministic for a given set of ids,
 * distinct for up to 24 ids. Pass all snapshot repositories, not the filtered ones, so filters never change a colour.
 */
export function assignRepoHues(ids: string[]): Map<string, number> {
  const hues = new Map<string, number>();
  const taken = new Set<number>();
  for (const id of [...new Set(ids)].sort()) {
    const preferred = fnv1a(id) % SLOTS;
    let slot = preferred;
    if (taken.size < SLOTS) {
      while (taken.has(slot)) slot = (slot + PROBE_STRIDE) % SLOTS;
      taken.add(slot);
    }
    hues.set(id, slot * SLOT_DEGREES);
  }
  return hues;
}

/** The `limit` most recently archived cards, newest archive first. Applied before grouping so it decides which cards show. */
export function recentArchived<T extends { archived?: string }>(cards: T[], limit: number): T[] {
  return [...cards].sort((a, b) => (b.archived ?? "").localeCompare(a.archived ?? "")).slice(0, limit);
}

export interface RepoGroup<T> {
  repoId: string;
  repoName: string;
  cards: T[];
}

/** Group cards by repository, ordered by repository name (case-insensitive); cards keep their input order. */
export function groupByRepo<T extends { repoId: string; repoName: string }>(cards: T[]): RepoGroup<T>[] {
  const groups = new Map<string, RepoGroup<T>>();
  for (const card of cards) {
    const group = groups.get(card.repoId);
    if (group) group.cards.push(card);
    else groups.set(card.repoId, { repoId: card.repoId, repoName: card.repoName, cards: [card] });
  }
  return [...groups.values()].sort(
    (a, b) => a.repoName.localeCompare(b.repoName, undefined, { sensitivity: "base" }) || a.repoId.localeCompare(b.repoId),
  );
}

/**
 * Tint props for an element that stands for a repository: the `repo-tint` class and the hue the theme turns into a
 * colour. A repository with no hue — one that is not in the snapshot — is left untinted.
 */
export function repoTint(hues: Map<string, number>, repoId: string): { class: string; style?: Record<string, string> } {
  const hue = hues.get(repoId);
  return hue === undefined ? { class: "" } : { class: "repo-tint", style: { "--repo-hue": String(hue) } };
}

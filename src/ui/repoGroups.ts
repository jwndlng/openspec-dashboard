// Repository grouping and colours for the board (group-changes-by-repo design D2, D5).
// Pure helpers: a repository contributes a hue only; the theme supplies lightness and chroma in CSS.

/**
 * The hues a repository may be painted in. Not a wheel: the status roles own six hues of their own
 * (danger, branch, warning, success, info, the indigo brand accent — see the token block in styles.css), and a
 * repository must never wear one of them, or its accent would read as "running" or "uncommitted". These 19 are
 * as many as the circle holds once each of those hues, in both themes, is given a ±12° berth and they keep 12° from
 * each other too: two below danger's berth, one between branch and warning, four between warning and success, five
 * between success and info, one between info and the accent, six between the accent and danger. The dark and the
 * light `info` share one hue for that reason: ten degrees apart, they would leave room for only 18. test/repoContrast.test.ts
 * recomputes both properties from the tokens rather than trusting this comment, so a retuned status colour fails
 * there instead of quietly colliding.
 */
export const REPO_HUES = [27, 39, 70, 105, 117, 129, 141, 178, 190, 202, 214, 226, 259, 290, 302, 314, 326, 338, 350];

/** The berth every repository hue keeps from every status hue, and from its neighbours, in degrees. */
export const MIN_HUE_GAP = 12;

const SLOTS = REPO_HUES.length;
/** Coprime with SLOTS, so probing reaches every slot and lands a displaced repo far from its first choice. */
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
 * Assign every repository id one of `REPO_HUES`. Deterministic for a given set of ids, distinct for up to 19 ids.
 * Pass all snapshot repositories, not the filtered ones, so filters never change a colour.
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
    hues.set(id, REPO_HUES[slot]);
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

/** A repository the combined board's "New change" form may create into. */
export interface NewChangeProject {
  id: string;
  name: string;
}

/**
 * The repositories the combined board's "New change" form offers, in snapshot order, and the one to pre-select: the only
 * eligible repository, else the only filtered one that is eligible. Eligible means the last scan succeeded — the same
 * check as the repository header's action; the server refuses anything else, so this is a convenience, not the guard.
 */
export function newChangeTargets(
  repos: { id: string; name: string; ok: boolean }[],
  filterRepoIds: string[],
): { projects: NewChangeProject[]; preselected?: string } {
  const projects = repos.filter((r) => r.ok).map((r) => ({ id: r.id, name: r.name }));
  if (projects.length === 1) return { projects, preselected: projects[0].id };
  const filtered = projects.filter((p) => filterRepoIds.includes(p.id));
  return filtered.length === 1 ? { projects, preselected: filtered[0].id } : { projects };
}

// Repository grouping and colours for the board (group-changes-by-repo design D2, D5).
// Pure helpers: a repository contributes a hue only; the theme supplies lightness and chroma in CSS.
import { fnv1a, REPO_HUES } from "../shared/hues.ts";
import { displayedLabels, labelKey } from "../shared/labels.ts";
import type { DetectedLabel } from "../shared/types.ts";

export { MIN_HUE_GAP, REPO_HUES } from "../shared/hues.ts";

const SLOTS = REPO_HUES.length;
/** Coprime with SLOTS, so probing reaches every slot and lands a displaced repo far from its first choice. */
const PROBE_STRIDE = 7;

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
  /** The repository's active changes, which a new change may depend on (`depends-on.yaml`). */
  changes?: DependencyChoice[];
}

/** An active change offered in the New change form's **Depends on** field. */
export interface DependencyChoice {
  name: string;
  column: string;
}

/** The changes a new change may depend on: the repository's active ones, by name. Archived changes are already met. */
export function dependencyChoices(changes: { name: string; column: string; archived?: string }[] = []): DependencyChoice[] {
  return changes
    .filter((c) => !c.archived)
    .map(({ name, column }) => ({ name, column }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The repositories the combined board's "New change" form offers, in snapshot order, and the one to pre-select: the only
 * eligible repository, else the only filtered one that is eligible. Eligible means the last scan succeeded — the same
 * check as the repository header's action; the server refuses anything else, so this is a convenience, not the guard.
 */
export function newChangeTargets(
  repos: { id: string; name: string; ok: boolean; changes?: { name: string; column: string; archived?: string }[] }[],
  filterRepoIds: string[],
): { projects: NewChangeProject[]; preselected?: string } {
  const projects = repos.filter((r) => r.ok).map((r) => ({ id: r.id, name: r.name, ...(r.changes ? { changes: dependencyChoices(r.changes) } : {}) }));
  if (projects.length === 1) return { projects, preselected: projects[0].id };
  const filtered = projects.filter((p) => filterRepoIds.includes(p.id));
  return filtered.length === 1 ? { projects, preselected: filtered[0].id } : { projects };
}

/** What label targeting needs of a snapshot repository. */
export interface LabelTargetRepo {
  id: string;
  name: string;
  ok: boolean;
  detectedLabels?: DetectedLabel[];
}

/** A repository displaying every selected label, and whether the "New change" form may create into it. */
export interface LabelTarget {
  id: string;
  name: string;
  eligible: boolean;
  /** Why it is skipped, in words; only when not eligible. */
  reason?: string;
}

export type LabelConfig = { repos: { id: string; labels?: string[]; hiddenLabels?: string[] }[]; labelColors?: Record<string, number> } | null | undefined;

const shownLabels = (repo: LabelTargetRepo, config: LabelConfig) => displayedLabels(config?.repos.find((r) => r.id === repo.id), repo.detectedLabels, config?.labelColors);

/** Every label displayed on at least one repository, each once ignoring case (first spelling wins), sorted by name. */
export function labelChoices(repos: LabelTargetRepo[], config: LabelConfig): string[] {
  const choices = new Map<string, string>();
  for (const repo of repos) for (const { label } of shownLabels(repo, config)) if (!choices.has(labelKey(label))) choices.set(labelKey(label), label);
  return [...choices.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * The repositories displaying all of `labels` (ignoring case), in snapshot order — the same AND as the overview's label
 * filter. No label selects nothing. Eligibility is the one `newChangeTargets` uses; the server refuses anything else.
 */
export function labelTargets(repos: LabelTargetRepo[], config: LabelConfig, labels: string[]): LabelTarget[] {
  if (labels.length === 0) return [];
  const wanted = labels.map(labelKey);
  return repos
    .filter((repo) => {
      const shown = new Set(shownLabels(repo, config).map((l) => labelKey(l.label)));
      return wanted.every((key) => shown.has(key));
    })
    .map((repo) => (repo.ok ? { id: repo.id, name: repo.name, eligible: true } : { id: repo.id, name: repo.name, eligible: false, reason: "its last scan failed" }));
}

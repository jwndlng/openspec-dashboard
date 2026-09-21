// Telling same-named repositories apart. Pure and path-separator agnostic: used by the Settings UI.

interface NamedPath {
  id: string;
  name: string;
  path: string;
}

const segments = (path: string) => path.split(/[\\/]+/).filter(Boolean);

/**
 * For every entry whose display name (ignoring case) is shared with another entry: the part of its parent path that
 * distinguishes it, i.e. the parent relative to the deepest directory all parents of that group have in common
 * (`acme` vs `ops/repo-mirror/repos`). An entry sitting directly in that common directory gets the directory's own
 * name. Entries with a unique name get no hint.
 */
export function nameHints(entries: NamedPath[]): Map<string, string> {
  const groups = new Map<string, NamedPath[]>();
  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const hints = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const parents = group.map((entry) => segments(entry.path).slice(0, -1));
    let common = 0;
    while (parents.every((p) => common < p.length && p[common] === parents[0][common])) common++;
    group.forEach((entry, i) => {
      const hint = parents[i].slice(common).join("/") || parents[i].at(-1) || "";
      if (hint) hints.set(entry.id, hint);
    });
  }
  return hints;
}

/** The name a newly enabled repository gets: its own, or `<name> (<parent directory>)` when that name is already in use. */
export function availableName(candidate: Pick<NamedPath, "name" | "path">, taken: string[]): string {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  if (!used.has(candidate.name.trim().toLowerCase())) return candidate.name;
  const parent = segments(candidate.path).at(-2);
  return parent ? `${candidate.name} (${parent})` : candidate.name;
}

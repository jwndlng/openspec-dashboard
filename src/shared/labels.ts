import type { DetectedLabel } from "./types.ts";

export const MAX_LABEL_LENGTH = 32;
export const MAX_LABELS = 20;

/** One directory entry as detection sees it: a name and what it is. Symbolic links are `other` and never match. */
export interface LabelEntry {
  name: string;
  kind: "file" | "dir" | "other";
}

export interface LabelRule {
  label: string;
  /** What the tooltip names as the reason, e.g. "`.tf` files". */
  marker: string;
  match: (entry: LabelEntry) => boolean;
}

const file = (name: string) => (e: LabelEntry) => e.kind === "file" && e.name === name;
const fileEnding = (suffix: string) => (e: LabelEntry) => e.kind === "file" && e.name.length > suffix.length && e.name.endsWith(suffix);

const named = (label: string, ...names: string[]): LabelRule[] => names.map((name) => ({ label, marker: `\`${name}\``, match: file(name) }));
const ending = (label: string, ...suffixes: string[]): LabelRule[] => suffixes.map((suffix) => ({ label, marker: `\`${suffix}\` files`, match: fileEnding(suffix) }));

/** Built in on purpose: a wrong guess is hidden per repository, not reconfigured. File names match case-sensitively. */
export const LABEL_RULES: readonly LabelRule[] = [
  ...ending("terraform", ".tf"),
  ...named("go", "go.mod"),
  ...named("rust", "Cargo.toml"),
  ...named("javascript", "package.json"),
  ...named("typescript", "tsconfig.json"),
  ...named("python", "pyproject.toml", "requirements.txt", "setup.py", "Pipfile"),
  ...named("ruby", "Gemfile"),
  ...named("java", "pom.xml", "build.gradle", "build.gradle.kts"),
  ...ending("dotnet", ".csproj", ".sln"),
  ...named("php", "composer.json"),
  ...named("swift", "Package.swift"),
  ...named("docker", "Dockerfile", "compose.yaml", "docker-compose.yml"),
  ...named("helm", "Chart.yaml"),
  ...named("ansible", "ansible.cfg"),
];

/** Labels the entries carry, sorted by name, each once; the first matching rule in table order gives the marker. */
export function detectLabels(entries: Iterable<LabelEntry>): DetectedLabel[] {
  const hits = new Map<string, { label: string; marker: string; rank: number }>();
  for (const entry of entries) {
    for (const [rank, rule] of LABEL_RULES.entries()) {
      if (!rule.match(entry)) continue;
      const seen = hits.get(rule.label);
      if (!seen || rank < seen.rank) hits.set(rule.label, { label: rule.label, marker: rule.marker, rank });
    }
  }
  return [...hits.values()].sort((a, b) => a.label.localeCompare(b.label)).map(({ label, marker }) => ({ label, marker }));
}

export type DisplayedLabel = { label: string; kind: "custom" } | { label: string; kind: "detected"; marker: string };

export const labelKey = (label: string) => label.toLowerCase();

/**
 * What a repository shows and is filtered by: its custom labels in the user's order, then the detected ones that are
 * neither hidden nor equal to a custom label (ignoring case), sorted. Rows, tiles, the board header and the filter all
 * use this, so they cannot disagree.
 */
export function displayedLabels(repo: { labels?: string[]; hiddenLabels?: string[] } | undefined, detected: DetectedLabel[] | undefined): DisplayedLabel[] {
  const custom = repo?.labels ?? [];
  const taken = new Set([...custom, ...(repo?.hiddenLabels ?? [])].map(labelKey));
  const shown = (detected ?? []).filter((d) => !taken.has(labelKey(d.label))).sort((a, b) => a.label.localeCompare(b.label));
  return [...custom.map((label) => ({ label, kind: "custom" as const })), ...shown.map((d) => ({ label: d.label, kind: "detected" as const, marker: d.marker }))];
}

/** Why `label` cannot be added next to `existing`, in words for the input; undefined when it can. Mirrors the config schema. */
export function labelProblem(label: string, existing: string[] = []): string | undefined {
  const trimmed = label.trim();
  if (!trimmed) return "A label cannot be empty.";
  if (trimmed.length > MAX_LABEL_LENGTH) return `A label has at most ${MAX_LABEL_LENGTH} characters.`;
  if (trimmed.includes(",")) return "A label cannot contain a comma.";
  if ([...trimmed].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return "A label cannot contain control characters.";
  if (existing.some((l) => labelKey(l) === labelKey(trimmed))) return `“${trimmed}” is already a label of this repository.`;
  if (existing.length >= MAX_LABELS) return `A repository has at most ${MAX_LABELS} labels.`;
  return undefined;
}

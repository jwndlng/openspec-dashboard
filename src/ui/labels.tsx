// Repository labels as chips: custom ones as the user typed them, detected ones with an icon and the marker that
// produced them, so the two are told apart by more than colour (project-labels).
import { useState } from "preact/hooks";
import { type DisplayedLabel, labelKey, labelProblem } from "../shared/labels.ts";
import type { DetectedLabel, RepoConfig } from "../shared/types.ts";
import { IconScan, IconX } from "./icons.tsx";

export function labelTitle(label: DisplayedLabel): string {
  return label.kind === "detected" ? `Detected from ${label.marker.replaceAll("`", "")}` : "Your label (Settings → Tracked repositories)";
}

function ChipContent({ label }: { label: DisplayedLabel }) {
  return (
    <>
      {label.kind === "detected" && <IconScan size={11} />}
      {label.label}
    </>
  );
}

/**
 * A repository's labels. With `onToggle` each chip is a button that adds or removes it from the overview's label filter
 * and never opens the repository; without it they are plain chips. `limit` keeps a table row to one line: the rest
 * moves into a `+<n>` indicator whose tooltip names them.
 */
export function LabelChips({ labels, limit, isActive, onToggle }: { labels: DisplayedLabel[]; limit?: number; isActive?: (label: string) => boolean; onToggle?: (label: string) => void }) {
  if (labels.length === 0) return null;
  const shown = limit === undefined ? labels : labels.slice(0, limit);
  const rest = labels.slice(shown.length);
  return (
    <span class="label-chips">
      {shown.map((label) => {
        const cls = `label-chip ${label.kind}`;
        if (!onToggle) {
          return (
            <span key={label.label} class={cls} title={labelTitle(label)}>
              <ChipContent label={label} />
            </span>
          );
        }
        const active = isActive?.(label.label) ?? false;
        return (
          <button
            key={label.label}
            type="button"
            class={`${cls} ${active ? "on" : ""}`}
            aria-pressed={active}
            title={`${labelTitle(label)} — ${active ? "remove from" : "add to"} the label filter`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(label.label);
            }}
          >
            <ChipContent label={label} />
          </button>
        );
      })}
      {rest.length > 0 && (
        <span class="label-more" title={rest.map((l) => l.label).join(", ")}>
          +{rest.length}
        </span>
      )}
    </span>
  );
}

/** Whether a detected label is hidden for this repository, ignoring case. */
const isHidden = (repo: Pick<RepoConfig, "hiddenLabels">, label: string) => (repo.hiddenLabels ?? []).some((h) => labelKey(h) === labelKey(label));

/** An empty list is written as no key at all, so a config never gains `labels: []`. */
const orAbsent = (labels: string[]) => (labels.length ? labels : undefined);

/**
 * Settings' labels line for one tracked repository: its custom labels (removable), an input that refuses a label the
 * config would refuse, and the detected labels of the last scan as show/hide toggles. Every edit goes to the draft.
 */
export function RepoLabelsEditor({
  repo,
  detected,
  suggestions,
  onChange,
}: {
  repo: RepoConfig;
  detected: DetectedLabel[];
  /** Labels used on other tracked repositories. */
  suggestions: string[];
  onChange: (patch: Pick<RepoConfig, "labels" | "hiddenLabels">) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const labels = repo.labels ?? [];
  const listId = `label-suggestions-${repo.id}`;
  const add = () => {
    const problem = labelProblem(text, labels);
    setError(problem);
    if (problem) return;
    onChange({ labels: [...labels, text.trim()] });
    setText("");
  };
  const toggleHidden = (label: string) => {
    const hidden = repo.hiddenLabels ?? [];
    onChange({ hiddenLabels: orAbsent(isHidden(repo, label) ? hidden.filter((h) => labelKey(h) !== labelKey(label)) : [...hidden, label]) });
  };
  const offered = suggestions.filter((s) => !labels.some((l) => labelKey(l) === labelKey(s)));
  return (
    <div class="repo-labels-edit">
      {labels.map((label) => (
        <span key={label} class="label-chip custom">
          {label}
          <button type="button" aria-label={`Remove label ${label}`} title="Remove this label" onClick={() => onChange({ labels: orAbsent(labels.filter((l) => l !== label)) })}>
            <IconX size={10} />
          </button>
        </span>
      ))}
      <input
        class="input label-input"
        placeholder="Add label…"
        aria-label={`Add a label to ${repo.name}`}
        list={listId}
        value={text}
        onInput={(e) => {
          setText(e.currentTarget.value);
          setError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          add();
        }}
      />
      <datalist id={listId}>
        {offered.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {error && (
        <span class="label-error" role="alert">
          {error}
        </span>
      )}
      {detected.map((d) => {
        const hidden = isHidden(repo, d.label);
        return (
          <button
            key={d.label}
            type="button"
            class={`label-chip detected ${hidden ? "hidden-label" : ""}`}
            aria-pressed={!hidden}
            title={`${labelTitle({ ...d, kind: "detected" })} — ${hidden ? "hidden; activate to show it again" : "activate to hide it for this repository"}`}
            onClick={() => toggleHidden(d.label)}
          >
            <IconScan size={11} />
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/** Every custom label of the other repositories, each once ignoring case, for the input's suggestions. */
export function labelSuggestions(repos: RepoConfig[], exceptId: string): string[] {
  const seen = new Map<string, string>();
  for (const r of repos) if (r.id !== exceptId) for (const l of r.labels ?? []) if (!seen.has(labelKey(l))) seen.set(labelKey(l), l);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

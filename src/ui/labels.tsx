// Repository labels as chips: custom ones as the user typed them, detected ones with an icon and the marker that
// produced them, so the two are told apart by more than colour (project-labels).
import { useState } from "preact/hooks";
import { REPO_HUES } from "../shared/hues.ts";
import { type DisplayedLabel, type LabelColors, labelHue, labelKey, type LabelOrigin, labelProblem, nearestAssignableHue } from "../shared/labels.ts";
import type { DetectedLabel, RepoConfig } from "../shared/types.ts";
import { IconCheck, IconScan, IconX } from "./icons.tsx";

export function labelTitle(label: LabelOrigin): string {
  return label.kind === "detected" ? `Detected from ${label.marker.replaceAll("`", "")}` : "Your label (Labels on the project's row or tile on Projects)";
}

/** The chip's colour: the theme turns the hue into text, border and fill (`.label-tint` in styles.css). */
export const labelHueStyle = (hue: number) => ({ "--label-hue": String(hue) });

function ChipContent({ label, active }: { label: DisplayedLabel; active?: boolean }) {
  return (
    <>
      {active && <IconCheck size={11} />}
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
        const cls = `label-chip label-tint ${label.kind}`;
        if (!onToggle) {
          return (
            <span key={label.label} class={cls} style={labelHueStyle(label.hue)} title={labelTitle(label)}>
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
            style={labelHueStyle(label.hue)}
            aria-pressed={active}
            title={`${labelTitle(label)} — ${active ? "remove from" : "add to"} the label filter`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(label.label);
            }}
          >
            <ChipContent label={label} active={active} />
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

/** The hue the user chose for a label, snapped to the palette; undefined when its colour is Auto. */
function chosenHue(label: string, colors: LabelColors): number | undefined {
  const key = labelKey(label);
  return colors && Object.hasOwn(colors, key) ? nearestAssignableHue(colors[key]) : undefined;
}

/**
 * The colours a label can take (project-labels: "The user can choose a label's colour"): Auto, which is the colour its
 * name derives, then every assignable hue. The current choice is pressed and carries a check, so it is not told by
 * colour alone. A choice applies to the label's name on every repository.
 */
export function LabelColorPicker({ label, colors, onChoose }: { label: string; colors: LabelColors; onChoose: (hue: number | null) => void }) {
  const chosen = chosenHue(label, colors);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want
    <div class="label-color-picker" role="group" aria-label={`Colour of ${label}`}>
      <button
        type="button"
        class={`label-color-option auto label-tint ${chosen === undefined ? "on" : ""}`}
        style={labelHueStyle(labelHue(label, undefined))}
        aria-pressed={chosen === undefined}
        title="Auto: the colour this label's name gives it"
        onClick={() => onChoose(null)}
      >
        <span class="label-swatch">{chosen === undefined && <IconCheck size={9} />}</span>
        Auto
      </button>
      {REPO_HUES.map((hue, i) => (
        <button
          key={hue}
          type="button"
          class={`label-color-option label-tint ${chosen === hue ? "on" : ""}`}
          style={labelHueStyle(hue)}
          aria-pressed={chosen === hue}
          aria-label={`Colour ${i + 1} of ${REPO_HUES.length}`}
          title={`Colour ${i + 1} of ${REPO_HUES.length} — for “${label}” on every project`}
          onClick={() => onChoose(hue)}
        >
          <span class="label-swatch">{chosen === hue && <IconCheck size={9} />}</span>
        </button>
      ))}
    </div>
  );
}

/** The button before a chip in the labels dialog that opens its colour picker, painted in the label's colour. */
function SwatchButton({ label, colors, open, onToggle }: { label: string; colors: LabelColors; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      class="label-swatch-button label-tint"
      style={labelHueStyle(labelHue(label, colors))}
      aria-label={`Colour of ${label}`}
      aria-expanded={open}
      title={`Choose the colour of “${label}” on every project`}
      onClick={onToggle}
    >
      <span class="label-swatch" />
    </button>
  );
}

/** An empty list is written as no key at all, so a config never gains `labels: []`. */
const orAbsent = (labels: string[]) => (labels.length ? labels : undefined);

/**
 * The labels editor for one tracked repository (in its dialog on Projects): its custom labels (removable), an input that refuses a label the
 * config would refuse, and the detected labels of the last scan as show/hide toggles. Every edit goes to `onChange`. Each
 * label has a swatch that opens its colour picker, one at a time; a colour goes to `onColor` and closes the picker.
 */
export function RepoLabelsEditor({
  repo,
  detected,
  suggestions,
  colors,
  onChange,
  onColor,
}: {
  repo: RepoConfig;
  detected: DetectedLabel[];
  /** Labels used on other tracked repositories. */
  suggestions: string[];
  /** The colours chosen for labels, shared by every repository (`Config.labelColors`). */
  colors: LabelColors;
  onChange: (patch: Pick<RepoConfig, "labels" | "hiddenLabels">) => void;
  onColor: (label: string, hue: number | null) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  /** The label, by key, whose colour picker is open. */
  const [picking, setPicking] = useState<string>();
  const swatch = (label: string) => <SwatchButton label={label} colors={colors} open={picking === labelKey(label)} onToggle={() => setPicking(picking === labelKey(label) ? undefined : labelKey(label))} />;
  const labels = repo.labels ?? [];
  const pickingLabel = picking === undefined ? undefined : [...labels, ...detected.map((d) => d.label)].find((l) => labelKey(l) === picking);
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
        <span key={label} class="label-entry">
          {swatch(label)}
          <span class="label-chip custom label-tint" style={labelHueStyle(labelHue(label, colors))}>
            {label}
            <button type="button" aria-label={`Remove label ${label}`} title="Remove this label" onClick={() => onChange({ labels: orAbsent(labels.filter((l) => l !== label)) })}>
              <IconX size={10} />
            </button>
          </span>
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
          <span key={d.label} class="label-entry">
            {swatch(d.label)}
            <button
              type="button"
              class={`label-chip detected label-tint ${hidden ? "hidden-label" : ""}`}
              style={labelHueStyle(labelHue(d.label, colors))}
              aria-pressed={!hidden}
              title={`${labelTitle({ ...d, kind: "detected" })} — ${hidden ? "hidden; activate to show it again" : "activate to hide it for this repository"}`}
              onClick={() => toggleHidden(d.label)}
            >
              <IconScan size={11} />
              {d.label}
            </button>
          </span>
        );
      })}
      {pickingLabel !== undefined && (
        <LabelColorPicker
          label={pickingLabel}
          colors={colors}
          onChoose={(hue) => {
            setPicking(undefined);
            onColor(pickingLabel, hue);
          }}
        />
      )}
    </div>
  );
}

/** Every custom label of the other repositories, each once ignoring case, for the input's suggestions. */
export function labelSuggestions(repos: RepoConfig[], exceptId: string): string[] {
  const seen = new Map<string, string>();
  for (const r of repos) if (r.id !== exceptId) for (const l of r.labels ?? []) if (!seen.has(labelKey(l))) seen.set(labelKey(l), l);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

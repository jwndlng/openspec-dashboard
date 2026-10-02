import { useMemo, useRef, useState } from "preact/hooks";
import { CHANGE_NAME_PATTERN } from "../shared/types.ts";
import { labelHue } from "../shared/labels.ts";
import { api, ApiError } from "./api.ts";
import { focusOnce } from "./focus.ts";
import { labelHueStyle } from "./labels.tsx";
import { IconFilePlus, IconX } from "./icons.tsx";
import { Modal } from "./modal.tsx";
import { type LabelConfig, labelChoices, labelTargets, type LabelTargetRepo, type NewChangeProject } from "./repoGroups.ts";

/** What the combined board and the overview hand the form so it can target repositories by label. */
export interface ByLabel {
  repos: LabelTargetRepo[];
  config: LabelConfig;
  /** Labels selected when the form opens; with `open`, the form opens in By label mode. */
  initial?: string[];
  open?: boolean;
}

/**
 * Where the form creates: one fixed repository (the repository header), or a choice among `projects` (the combined board
 * and the overview) — one of them, or with `byLabel` every eligible repository displaying a set of labels.
 */
export type NewChangeTarget =
  | { repoId: string; repoName: string }
  | { projects: NewChangeProject[]; /** The project chosen when the form opens, if the choice is unambiguous. */ preselected?: string; byLabel?: ByLabel };

type Mode = "project" | "label";

/** One repository's outcome of creating a change by label: created (and whether it was staged), or refused and why. */
export type RepoCreateResult = { repoId: string; repoName: string; ok: true; staged: boolean } | { repoId: string; repoName: string; ok: false; message: string };

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Creates `name` in each repository with the very request the single-project form sends, one at a time and in order, so
 * every write is the already-specified create. A refusal is that repository's result and never stops the rest; nothing
 * created is undone. A create that lands during a running scan may be missing from it, so once at least one succeeded a
 * fresh scan is asked for until the server says one started — after the last create, it sees them all.
 */
export async function createInRepos(
  repos: { id: string; name: string }[],
  name: string,
  prompt: string | undefined,
  onProgress: (repoId: string) => void = () => {},
  wait: (ms: number) => Promise<void> = pause,
): Promise<RepoCreateResult[]> {
  const results: RepoCreateResult[] = [];
  for (const repo of repos) {
    onProgress(repo.id);
    try {
      const created = await api.createChange(repo.id, name, prompt);
      results.push({ repoId: repo.id, repoName: repo.name, ok: true, staged: created.staged });
    } catch (err) {
      results.push({ repoId: repo.id, repoName: repo.name, ok: false, message: errorText(err) });
    }
  }
  if (results.some((r) => r.ok)) {
    for (let attempt = 0; attempt < 20; attempt++) {
      // A scan request that fails is not retried: the board's own polling picks the changes up.
      const { started } = await api.scan().catch(() => ({ started: true }));
      if (started) break;
      await wait(250);
    }
  }
  return results;
}

const plural = (n: number) => `${n} ${n === 1 ? "project" : "projects"}`;

/**
 * Small inline form: a change name (validated live against `CHANGE_NAME_PATTERN`) and an optional prompt, plus a project
 * dropdown when opened from the combined board — or, in By label mode, the labels to target and a checklist of the
 * repositories displaying them. On success the server has already triggered a rescan; `onCreated` lets the parent pick
 * up the new state without waiting for the next poll. By label stays open on its per-repository results and asks the
 * parent to refresh through `onReload` instead.
 */
export function NewChangeForm({ target, onClose, onCreated, onReload, onBusy }: { target: NewChangeTarget; onClose: () => void; onCreated: () => void; onReload?: () => void; onBusy?: (busy: boolean) => void }) {
  const projects = "projects" in target ? target.projects : undefined;
  const byLabel = "projects" in target ? target.byLabel : undefined;
  const [mode, setMode] = useState<Mode>(byLabel?.open ? "label" : "project");
  const [chosen, setChosen] = useState("projects" in target ? (target.preselected ?? "") : "");
  const [labels, setLabels] = useState<string[]>(byLabel?.initial ?? []);
  // Unchecked rather than checked ids, so a repository that starts to match when a label is added starts checked.
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusyState] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [results, setResults] = useState<RepoCreateResult[] | null>(null);
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusy?.(next);
  };
  // One stable ref for the first field to fill, focused when the form opens and never again. Which field that is — the
  // dropdown or the label picker when nothing is chosen yet, else the name — is decided once, so nothing later moves it.
  const focusFirst = useMemo(focusOnce, []);
  const [first] = useState<"project" | "label" | "name">(mode === "label" ? (labels.length === 0 ? "label" : "name") : projects !== undefined && chosen === "" ? "project" : "name");

  // A project that stopped being eligible while the form is open counts as no choice: derived, so focus is untouched.
  const repoId = "repoId" in target ? target.repoId : projects?.some((p) => p.id === chosen) ? chosen : "";
  const repoName = "repoName" in target ? target.repoName : projects?.find((p) => p.id === repoId)?.name;

  // Derived on every render, so a repository whose scan fails while the form is open is skipped, never sent.
  const choices = byLabel ? labelChoices(byLabel.repos, byLabel.config) : [];
  const matches = byLabel ? labelTargets(byLabel.repos, byLabel.config, labels) : [];
  const checked = matches.filter((m) => m.eligible && !unchecked.has(m.id));
  const unpicked = choices.filter((c) => !labels.some((l) => l.toLowerCase() === c.toLowerCase()));

  const trimmed = name.trim();
  const nameError = trimmed === "" ? "required" : CHANGE_NAME_PATTERN.test(trimmed) ? null : "only letters, digits, dots, dashes and underscores";
  const whereError = mode === "project" ? (repoId === "" ? "choose a project" : null) : labels.length === 0 ? "choose a label" : checked.length === 0 ? "check at least one project" : null;
  const canSubmit = nameError === null && whereError === null && !busy;

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    if (mode === "label") {
      const done = await createInRepos(checked, trimmed, prompt.trim() || undefined, setWorking);
      setResults(done);
      setWorking(null);
      setBusy(false);
      if (done.some((r) => r.ok)) onReload?.();
      return;
    }
    try {
      await api.createChange(repoId, trimmed, prompt.trim() || undefined);
      onCreated();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  if (results) {
    const created = results.filter((r) => r.ok).length;
    return (
      <div class="new-change">
        <p class="new-change-summary">
          <span class="mono">{trimmed}</span> created in {created} of {plural(results.length)}.
        </p>
        <ul class="new-change-results" aria-label="Result per project">
          {results.map((r) => (
            <li key={r.repoId} class={r.ok ? "ok" : "refused"}>
              <span class="repo">{r.repoName}</span>
              <span class="outcome">{r.ok ? (r.staged ? "created and staged" : "created, not staged") : `refused: ${r.message}`}</span>
            </li>
          ))}
        </ul>
        <div class="row actions">
          <button type="button" class="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form class="new-change" onSubmit={onSubmit} aria-label={mode === "project" && repoName ? `New change in ${repoName}` : "New change"}>
      {byLabel && (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want
        <div class="segmented new-change-mode" role="group" aria-label="Create in">
          {(["project", "label"] as Mode[]).map((m) => (
            <button key={m} type="button" class={mode === m ? "on" : ""} aria-pressed={mode === m} disabled={busy} onClick={() => setMode(m)}>
              {m === "project" ? "One project" : "By label"}
            </button>
          ))}
        </div>
      )}
      {projects && mode === "project" && (
        <div class="row">
          <label class="new-change-project">
            <span>Project</span>
            <select class="input" value={repoId} ref={first === "project" ? focusFirst : undefined} onChange={(e) => setChosen((e.currentTarget as HTMLSelectElement).value)}>
              <option value="">Choose a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {repoId === "" && <span class="hint">choose a project</span>}
          </label>
        </div>
      )}
      {byLabel && mode === "label" && (
        <div class="new-change-labels">
          <label class="new-change-label-picker">
            <span>Labels</span>
            <select
              class="input"
              value=""
              ref={first === "label" ? focusFirst : undefined}
              disabled={busy || unpicked.length === 0}
              onChange={(e) => {
                const value = (e.currentTarget as HTMLSelectElement).value;
                if (value) setLabels([...labels, value]);
              }}
            >
              <option value="">{choices.length === 0 ? "No project displays a label" : unpicked.length === 0 ? "Every label is selected" : "Add a label…"}</option>
              {unpicked.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {labels.length > 0 && (
            <div class="label-chips">
              {labels.map((l) => (
                <button key={l} type="button" class="label-chip label-tint on" style={labelHueStyle(labelHue(l, byLabel?.config?.labelColors))} disabled={busy} title={`Remove ${l}`} aria-label={`Remove label ${l}`} onClick={() => setLabels(labels.filter((x) => x !== l))}>
                  {l}
                  <IconX size={10} />
                </button>
              ))}
            </div>
          )}
          {labels.length > 0 && matches.length === 0 && <p class="hint">No project displays {labels.length === 1 ? "this label" : "all of these labels"}.</p>}
          {matches.length > 0 && (
            <ul class="new-change-targets" aria-label="Projects to create in">
              {matches.map((m) => (
                <li key={m.id} class={m.eligible ? "" : "skipped"}>
                  <input
                    type="checkbox"
                    id={`new-change-target-${m.id}`}
                    checked={m.eligible && !unchecked.has(m.id)}
                    disabled={!m.eligible || busy}
                    onChange={(e) => {
                      const next = new Set(unchecked);
                      if ((e.currentTarget as HTMLInputElement).checked) next.delete(m.id);
                      else next.add(m.id);
                      setUnchecked(next);
                    }}
                  />
                  <label for={`new-change-target-${m.id}`}>{m.name}</label>
                  {!m.eligible && <span class="hint">skipped: {m.reason}</span>}
                  {working === m.id && <span class="hint">creating…</span>}
                </li>
              ))}
            </ul>
          )}
          {whereError && <span class="hint">{whereError}</span>}
        </div>
      )}
      <div class="row">
        <label class="new-change-name">
          <span>Change name</span>
          <input
            class="input"
            type="text"
            value={name}
            placeholder="add-audit-trail"
            ref={first === "name" ? focusFirst : undefined}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
          {trimmed !== "" && nameError && <span class="hint danger">{nameError}</span>}
        </label>
      </div>
      <div class="row">
        <label class="new-change-prompt">
          <span>Prompt (optional)</span>
          <textarea
            class="input"
            rows={3}
            value={prompt}
            placeholder="What is this change about? An agent can pick up from here."
            onInput={(e) => setPrompt((e.currentTarget as HTMLTextAreaElement).value)}
          />
        </label>
      </div>
      {error && <div class="notice danger">{error}</div>}
      <div class="row actions">
        <button type="submit" class="btn primary" disabled={!canSubmit}>
          {mode === "label" ? (busy ? "Creating…" : `Create in ${plural(checked.length)}`) : busy ? "Creating…" : "Create change"}
        </button>
        <button type="button" class="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The form in a dialog over the page, like the change detail view. None of the ways to close it applies while the
 * change is being created — in By label mode, until the last repository has answered — so a request in flight is never
 * abandoned half-way.
 */
export function NewChangeDialog({ target, onClose, onCreated, onReload }: { target: NewChangeTarget; onClose: () => void; onCreated: () => void; onReload?: () => void }) {
  const busy = useRef(false);
  const where = "repoName" in target ? target.repoName : undefined;
  return (
    <Modal
      label={where ? `New change in ${where}` : "New change"}
      title="New change"
      subtitle={<span class="mono">{where ? `${where}/` : ""}openspec/changes/&lt;name&gt;/</span>}
      icon={<IconFilePlus size={18} />}
      onClose={onClose}
      canClose={() => !busy.current}
    >
      <NewChangeForm
        target={target}
        onClose={() => {
          if (!busy.current) onClose();
        }}
        onCreated={onCreated}
        onReload={onReload}
        onBusy={(next) => {
          busy.current = next;
        }}
      />
    </Modal>
  );
}

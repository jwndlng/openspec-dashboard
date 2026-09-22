import { useMemo, useState } from "preact/hooks";
import { CHANGE_NAME_PATTERN } from "../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { focusOnce } from "./focus.ts";
import type { NewChangeProject } from "./repoGroups.ts";

/** Where the form creates: one fixed repository (the repository header), or a choice among `projects` (the combined board). */
export type NewChangeTarget =
  | { repoId: string; repoName: string }
  | { projects: NewChangeProject[]; /** The project chosen when the form opens, if the choice is unambiguous. */ preselected?: string };

/**
 * Small inline form: a change name (validated live against `CHANGE_NAME_PATTERN`) and an optional prompt, plus a project
 * dropdown when opened from the combined board. On success the server has already triggered a rescan; `onCreated` lets
 * the parent pick up the new state without waiting for the next poll.
 */
export function NewChangeForm({ target, onClose, onCreated }: { target: NewChangeTarget; onClose: () => void; onCreated: () => void }) {
  const projects = "projects" in target ? target.projects : undefined;
  const [chosen, setChosen] = useState("projects" in target ? (target.preselected ?? "") : "");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One stable ref for the first field to fill, focused when the form opens and never again. Which field that is — the
  // dropdown when nothing is pre-selected, else the name — is decided once, so a later choice or poll never moves it.
  const focusFirst = useMemo(focusOnce, []);
  const [focusProject] = useState(projects !== undefined && chosen === "");

  // A project that stopped being eligible while the form is open counts as no choice: derived, so focus is untouched.
  const repoId = "repoId" in target ? target.repoId : projects?.some((p) => p.id === chosen) ? chosen : "";
  const repoName = "repoName" in target ? target.repoName : projects?.find((p) => p.id === repoId)?.name;

  const trimmed = name.trim();
  const nameError = trimmed === "" ? "required" : CHANGE_NAME_PATTERN.test(trimmed) ? null : "only letters, digits, dots, dashes and underscores";
  const canSubmit = nameError === null && repoId !== "" && !busy;

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.createChange(repoId, trimmed, prompt.trim() || undefined);
      onCreated();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setError(message);
      setBusy(false);
    }
  };

  return (
    <form class="new-change" onSubmit={onSubmit} aria-label={repoName ? `New change in ${repoName}` : "New change"}>
      {projects && (
        <div class="row">
          <label class="new-change-project">
            <span>Project</span>
            <select class="input" value={repoId} ref={focusProject ? focusFirst : undefined} onChange={(e) => setChosen((e.currentTarget as HTMLSelectElement).value)}>
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
      <div class="row">
        <label class="new-change-name">
          <span>Change name</span>
          <input
            class="input"
            type="text"
            value={name}
            placeholder="add-audit-trail"
            ref={focusProject ? undefined : focusFirst}
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
          {busy ? "Creating…" : "Create change"}
        </button>
        <button type="button" class="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

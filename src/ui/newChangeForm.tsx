import { useMemo, useState } from "preact/hooks";
import { CHANGE_NAME_PATTERN } from "../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { focusOnce } from "./focus.ts";

/**
 * Small inline form on the repository board header: a change name (validated live against `CHANGE_NAME_PATTERN`) and an
 * optional prompt. On success the server has already triggered a rescan; `onCreated` lets the parent pick up the new
 * state without waiting for the next poll.
 */
export function NewChangeForm({ repoId, repoName, onClose, onCreated }: { repoId: string; repoName: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const focusName = useMemo(focusOnce, []); // one stable ref: the name field is focused when the form opens, never again

  const trimmed = name.trim();
  const nameError = trimmed === "" ? "required" : CHANGE_NAME_PATTERN.test(trimmed) ? null : "only letters, digits, dots, dashes and underscores";
  const canSubmit = nameError === null && !busy;

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
    <form class="new-change" onSubmit={onSubmit} aria-label={`New change in ${repoName}`}>
      <div class="row">
        <label class="new-change-name">
          <span>Change name</span>
          <input
            class="input"
            type="text"
            value={name}
            placeholder="add-audit-trail"
            ref={focusName}
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

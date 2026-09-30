// Dismissing a change (openspec/specs/change-dismissal): the confirmation that lists what would be deleted and whether
// git could bring each file back. Nothing is deleted until the user confirms, and the server re-checks that the change
// is still exactly what this dialog showed.
import { useEffect, useRef, useState } from "preact/hooks";
import type { DismissPreview, DismissResult } from "../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { lossWarning, stagingNote } from "./dismissState.ts";
import { Modal } from "./modal.tsx";

export function DismissDialog({
  repoId,
  repoName,
  change,
  onClose,
  onDismissed,
}: {
  repoId: string;
  repoName: string;
  change: string;
  onClose: () => void;
  onDismissed: (result: DismissResult, preview: DismissPreview) => void;
}) {
  const [preview, setPreview] = useState<DismissPreview>();
  const [error, setError] = useState<string>();
  /** A refusal because the change moved on; offers to look again. */
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let stale = false;
    setPreview(undefined);
    api.dismissPreview(repoId, change).then(
      (p) => !stale && setPreview(p),
      (err) => !stale && setError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      stale = true;
    };
  }, [repoId, change, generation]);

  // Cancel has the focus: the safe answer is the one Enter gives.
  useEffect(() => cancel.current?.focus(), []);

  const lookAgain = () => {
    setError(undefined);
    setRefused(false);
    setGeneration((n) => n + 1);
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError(undefined);
    try {
      onDismissed(await api.dismissChange(repoId, change, preview.fingerprint), preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRefused(err instanceof ApiError && err.status === 409);
    } finally {
      setBusy(false);
    }
  };

  const warning = preview && lossWarning(preview);
  return (
    <Modal label={`Dismiss change ${change}`} title="Dismiss change" subtitle={<><span class="mono">{change}</span> in {repoName}</>} onClose={onClose} canClose={() => !busy}>
      <div class="dismiss-body">
        <p class="hint">
          Deletes <span class="mono">openspec/changes/{change}/</span> from the main checkout. Use this for a change you are not going ahead with; a finished
          change is archived instead.
        </p>
        {!preview && !error && <p class="hint">Looking at the change's files…</p>}
        {preview && (
          <>
            {warning && (
              <div class="notice danger" role="alert">
                {warning}
              </div>
            )}
            {preview.files.length === 0 ? (
              <p class="hint">The directory is empty.</p>
            ) : (
              <ul class="dismiss-files">
                {preview.files.map((f) => (
                  <li key={f.path}>
                    <span class="mono">{f.path}</span>{" "}
                    {f.state === "lost" ? <span class="badge danger">lost for good</span> : <span class="badge">restorable from git</span>}
                  </li>
                ))}
              </ul>
            )}
            {preview.copies.length > 0 && (
              <div class="notice warn">
                {preview.copies.length === 1 ? "A worktree holds" : "These worktrees hold"} its own copy, which is kept — the change stays on the board while one does:
                <ul class="dismiss-files">
                  {preview.copies.map((c) => (
                    <li key={c.path}>
                      <span class="mono">{c.path}</span> {c.branch && <span class="badge">{c.branch}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p class="hint">{stagingNote(preview)}</p>
          </>
        )}
        {error && (
          <div class="notice danger">
            {error}
            {refused && (
              <>
                {" "}
                <button type="button" class="btn sm" onClick={lookAgain}>
                  Show current state
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div class="row dismiss-actions">
        <button ref={cancel} type="button" class="btn sm" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" class="btn sm danger" disabled={busy || !preview || refused} onClick={() => void confirm()}>
          {busy ? "Dismissing…" : "Dismiss change"}
        </button>
      </div>
    </Modal>
  );
}

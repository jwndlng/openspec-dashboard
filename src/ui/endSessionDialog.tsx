// Ending a session, from a card or from the panel, goes through this one dialog. It asks as loudly as the work in the
// worktree is unshipped, on the strength of a status read at this moment rather than the list's cached one.
import { useEffect, useState } from "preact/hooks";
import type { WorkStatus } from "../shared/types.ts";
import { api } from "./api.ts";
import { endSeverity, endWarning } from "./sessionState.ts";
import { useSessionUi } from "./sessions.tsx";

interface Status {
  removable: boolean;
  reason?: string;
  work?: WorkStatus;
}

export function EndSessionDialog() {
  const ui = useSessionUi();
  const id = ui.endingId;
  const session = ui.sessions.find((s) => s.id === id);
  const [status, setStatus] = useState<Status>();
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setStatus(undefined);
    setRemove(false);
    setBusy(false);
    setError(undefined);
    if (!id) return;
    let stale = false;
    api
      .worktreeStatus(id)
      .then((result) => {
        if (stale) return;
        setStatus(result);
        setRemove(result.removable && result.work?.state === "merged"); // merged work: removing the worktree is what is left to do
      })
      .catch(() => !stale && setStatus({ removable: false, reason: "could not check the worktree" }));
    return () => {
      stale = true;
    };
  }, [id]);

  // Escape cancels, wherever the keyboard focus is (it is usually still in the terminal).
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && ui.requestEnd(undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, ui.requestEnd]);

  if (!id || !session) return null;
  const running = session.state === "running";
  const severity = endSeverity(status?.work);
  const warning = endWarning(status?.work);
  const close = () => ui.requestEnd(undefined);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await ui.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div class="overlay end-overlay">
      <div class="dialog end-dialog" role="alertdialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-body">
        <strong id="end-title">
          {running ? "End the session for " : "Clean up the session for "}
          <span class="mono">{session.change}</span>?
        </strong>
        <div id="end-body" class="dialog-body">
          {!status && <div class="hint">Checking the worktree…</div>}
          {warning && (
            <div class={`notice ${severity === "danger" ? "danger" : "warn"}`}>
              <strong>{severity === "danger" ? "⚠ Not shipped. " : "Note: "}</strong>
              {warning}
            </div>
          )}
          <div class="hint">
            {running && `${session.agentName} is stopped, as if you closed its terminal window. `}
            The worktree and its branch <span class="mono">{session.branch}</span> are kept{status?.removable ? " unless you remove the worktree below" : ""}; the work shows up under Open work until it is
            merged.
          </div>
          {status?.removable ? (
            <label class="check">
              <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.currentTarget.checked)} /> also remove the worktree (clean, and its work is merged or exists elsewhere)
            </label>
          ) : (
            status?.reason && <div class="hint">The worktree cannot be removed: {status.reason}.</div>
          )}
          {error && <div class="notice danger">{error}</div>}
        </div>
        <div class="row">
          <button type="button" class="btn sm ghost" onClick={close}>
            Cancel
          </button>
          <span style={{ flex: 1 }} />
          {severity === "danger" && (
            <button
              type="button"
              class="btn sm primary"
              disabled={busy}
              title={`Asks ${session.agentName} to commit, push and open a pull request instead of ending`}
              onClick={() =>
                run(async () => {
                  const result = await api.shipSession(session.id);
                  ui.openPanel(session.id);
                  ui.reportUnsent(result.submitted ? undefined : session.id);
                })
              }
            >
              ⇪ Ship instead
            </button>
          )}
          <button type="button" class={`btn sm ${severity === "danger" ? "danger" : "primary"}`} disabled={busy || !status} onClick={() => run(() => api.closeSession(session.id, remove && status?.removable === true))}>
            {severity === "danger" ? "End anyway" : running ? "End session" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

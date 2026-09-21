// The Pull controls. A pull contacts the repository's remote and fast-forwards its main checkout — the one thing in
// the dashboard that does — so it only ever happens from these buttons.
import { type ComponentChildren, createContext } from "preact";
import { useContext, useState } from "preact/hooks";
import type { PullResult } from "../shared/types.ts";
import { api } from "./api.ts";
import { pullOutcome } from "./pullState.ts";

type PullState = "running" | PullResult;

interface PullUi {
  states: Record<string, PullState>;
  pull(repoId: string): void;
  pullAll(repoIds: string[]): void;
  allRunning: boolean;
}

const Context = createContext<PullUi>({ states: {}, pull: () => {}, pullAll: () => {}, allRunning: false });

/** Outcomes live here, in memory: a reload forgets them, the repositories keep what the pull did. */
export function PullProvider({ onPulled, children }: { onPulled: () => void; children: ComponentChildren }) {
  const [states, setStates] = useState<Record<string, PullState>>({});
  const [allRunning, setAllRunning] = useState(false);
  const set = (repoId: string, state: PullState) => setStates((prev) => ({ ...prev, [repoId]: state }));
  const failed = (repoId: string, err: unknown): PullResult => ({ repoId, fetched: false, update: "failed", reason: err instanceof Error ? err.message : String(err) });

  const pull = (repoId: string) => {
    if (states[repoId] === "running") return;
    set(repoId, "running");
    api.pullRepo(repoId).then(
      (result) => set(repoId, result),
      (err) => set(repoId, failed(repoId, err)),
    ).finally(onPulled);
  };

  const pullAll = (repoIds: string[]) => {
    if (allRunning) return;
    setAllRunning(true);
    setStates((prev) => ({ ...prev, ...Object.fromEntries(repoIds.map((id) => [id, "running" as const])) }));
    api.pullAll().then(
      ({ results }) => setStates((prev) => ({ ...prev, ...Object.fromEntries(repoIds.map((id) => [id, results.find((r) => r.repoId === id) ?? failed(id, "not pulled: not a tracked, scanned git repository")])) })),
      (err) => setStates((prev) => ({ ...prev, ...Object.fromEntries(repoIds.map((id) => [id, failed(id, err)])) })),
    ).finally(() => {
      setAllRunning(false);
      onPulled();
    });
  };

  return <Context.Provider value={{ states, pull, pullAll, allRunning }}>{children}</Context.Provider>;
}

const PULL_HINT = "Fetch this repository's remote and fast-forward its main checkout. Never merges, rebases, stashes or switches branches; off the default branch it only fetches.";

export function PullButton({ repoId, compact = false }: { repoId: string; compact?: boolean }) {
  const ui = useContext(Context);
  const state = ui.states[repoId];
  const running = state === "running";
  const outcome = state && state !== "running" ? pullOutcome(state) : undefined;
  return (
    <span class="pull">
      <button
        type="button"
        class={`btn sm ${compact ? "ghost" : ""}`}
        title={PULL_HINT}
        disabled={running}
        onClick={(e) => {
          e.stopPropagation(); // in an overview row, a click must not open the repository
          ui.pull(repoId);
        }}
      >
        {running ? "Pulling…" : "⇣ Pull"}
      </button>
      {outcome && (
        <span class={`badge ${outcome.tone}`} title={outcome.detail}>
          {outcome.label}
        </span>
      )}
    </span>
  );
}

export function PullAllButton({ repoIds }: { repoIds: string[] }) {
  const ui = useContext(Context);
  const results = repoIds.map((id) => ui.states[id]).filter((s): s is PullResult => s !== undefined && s !== "running");
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    const label = pullOutcome(r).label.startsWith("+") ? "updated" : pullOutcome(r).label;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <span class="pull">
      <button type="button" class="btn sm" title={`${PULL_HINT} Runs for every tracked git repository, a few at a time.`} disabled={ui.allRunning || repoIds.length === 0} onClick={() => ui.pullAll(repoIds)}>
        {ui.allRunning ? "Pulling all…" : "⇣ Pull all"}
      </button>
      {!ui.allRunning && results.length > 0 && (
        <span class="hint" title="Each repository's own outcome is shown in its row">
          {Object.entries(counts)
            .map(([label, n]) => `${n} ${label}`)
            .join(" · ")}
        </span>
      )}
    </span>
  );
}

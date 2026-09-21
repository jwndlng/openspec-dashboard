// The Pull controls. A pull contacts the repository's remote and fast-forwards its main checkout — the one thing in
// the dashboard that does — so it only ever happens from these buttons.
import { type ComponentChildren, createContext } from "preact";
import { useContext, useRef, useState } from "preact/hooks";
import type { PullResult } from "../shared/types.ts";
import { api } from "./api.ts";
import { pullOutcome } from "./pullState.ts";

type PullState = "running" | PullResult;

interface PullUi {
  states: Record<string, PullState>;
  /**
   * Starts a pull and resolves with its outcome — never rejects; a failed call becomes a `failed` result. A pull
   * already running for this repository is joined rather than started again, so the caller gets that one's outcome.
   */
  pull(repoId: string): Promise<PullResult>;
  pullAll(repoIds: string[]): void;
  allRunning: boolean;
}

const NO_PROVIDER = (repoId: string): PullResult => ({ repoId, fetched: false, update: "failed", reason: "no pull provider" });

const Context = createContext<PullUi>({ states: {}, pull: (repoId) => Promise.resolve(NO_PROVIDER(repoId)), pullAll: () => {}, allRunning: false });

/** For anything outside this module that starts a pull and wants to say what came of it (the end-session dialog). */
export const usePull = () => useContext(Context);

/** Outcomes live here, in memory: a reload forgets them, the repositories keep what the pull did. */
export function PullProvider({ onPulled, children }: { onPulled: () => void; children: ComponentChildren }) {
  const [states, setStates] = useState<Record<string, PullState>>({});
  const [allRunning, setAllRunning] = useState(false);
  const set = (repoId: string, state: PullState) => setStates((prev) => ({ ...prev, [repoId]: state }));
  const failed = (repoId: string, err: unknown): PullResult => ({ repoId, fetched: false, update: "failed", reason: err instanceof Error ? err.message : String(err) });
  // The pull running for a repository, by id. A ref, not state: `pull` must see it in the call, not after a render.
  const inFlight = useRef<Record<string, Promise<PullResult>>>({});

  const pull = (repoId: string): Promise<PullResult> => {
    const running = inFlight.current[repoId];
    if (running) return running; // one pull per repository, whether it came from here or from "Pull all"
    set(repoId, "running");
    const done = api
      .pullRepo(repoId)
      .then(
        (result) => result,
        (err) => failed(repoId, err),
      )
      .then((result) => {
        delete inFlight.current[repoId];
        set(repoId, result);
        onPulled();
        return result;
      });
    inFlight.current[repoId] = done;
    return done;
  };

  const pullAll = (repoIds: string[]) => {
    if (allRunning) return;
    setAllRunning(true);
    setStates((prev) => ({ ...prev, ...Object.fromEntries(repoIds.map((id) => [id, "running" as const])) }));
    const done = api.pullAll().then(
      ({ results }) => Object.fromEntries(repoIds.map((id) => [id, results.find((r) => r.repoId === id) ?? failed(id, "not pulled: not a tracked, scanned git repository")])),
      (err) => Object.fromEntries(repoIds.map((id) => [id, failed(id, err)])),
    );
    // Each repository gets its share of this run, so a single pull started meanwhile joins it instead of fetching twice.
    for (const id of repoIds) inFlight.current[id] = done.then((byId) => byId[id] as PullResult);
    void done.then((byId) => {
      for (const id of repoIds) delete inFlight.current[id];
      setStates((prev) => ({ ...prev, ...byId }));
      setAllRunning(false);
      onPulled();
    });
  };

  return <Context.Provider value={{ states, pull, pullAll, allRunning }}>{children}</Context.Provider>;
}

const PULL_HINT = "Fetch this repository's remote and fast-forward its main checkout. Never merges, rebases, stashes or switches branches; off the default branch it only fetches.";

export function PullButton({ repoId, compact = false }: { repoId: string; compact?: boolean }) {
  const ui = usePull();
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
          void ui.pull(repoId);
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
  const ui = usePull();
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

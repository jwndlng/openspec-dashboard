// The projects overview's discovery runs. Kept outside any component so that returning to the overview shows the last
// result at once while a fresh run is under way. Pure: the request is passed in, so tests need no server.
import type { DiscoverResult } from "../shared/types.ts";

export interface DiscoveryState {
  /** The latest run's result; kept while the next one runs. */
  result?: DiscoverResult;
  running: boolean;
  /** Why the latest run failed, if it did. */
  error?: string;
}

export interface DiscoveryStore {
  get(): DiscoveryState;
  /** Starts a run; overlapping runs are allowed, and only the latest one started is applied. */
  run(): Promise<void>;
  /** Forgets the result, for a config without workspace roots: there is nothing to discover. */
  clear(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store over one discovery request. The overview's request takes no arguments — the server uses the saved roots and
 * ignore paths — so a result found for Settings' unsaved draft can never end up on the overview.
 */
export function createDiscoveryStore(discover: () => Promise<DiscoverResult>): DiscoveryStore {
  let state: DiscoveryState = { running: false };
  let seq = 0;
  const listeners = new Set<() => void>();
  const set = (next: DiscoveryState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    async run() {
      const mine = ++seq;
      set({ ...state, running: true });
      try {
        const result = await discover();
        if (mine === seq) set({ result, running: false });
      } catch (err) {
        if (mine === seq) set({ ...state, running: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
    clear() {
      seq++;
      set({ running: false });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

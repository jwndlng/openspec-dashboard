import { expect, test } from "bun:test";
import type { DiscoverResult } from "../src/shared/types.ts";
import { createDiscoveryStore } from "../src/ui/discoveryState.ts";

const result = (name: string): DiscoverResult => ({ candidates: [{ id: name, path: `/w/acme/${name}`, name, enabled: false }], integratable: [], errors: [] });

/** A request whose answers the test hands out in any order. */
function controlled() {
  const pending: ((r: DiscoverResult) => void)[] = [];
  const calls: unknown[][] = [];
  const discover = (...args: unknown[]) => {
    calls.push(args);
    return new Promise<DiscoverResult>((resolve) => pending.push(resolve));
  };
  return { discover, pending, calls };
}

test("only the latest run is applied, whatever order the answers arrive in", async () => {
  const { discover, pending } = controlled();
  const store = createDiscoveryStore(discover);
  const first = store.run();
  const second = store.run();
  expect(store.get().running).toBe(true);
  pending[1](result("second"));
  await second;
  pending[0](result("first"));
  await first;
  expect(store.get()).toEqual({ result: result("second"), running: false });
});

test("the previous result stays while a new run is in progress", async () => {
  const { discover, pending } = controlled();
  const store = createDiscoveryStore(discover);
  const first = store.run();
  pending[0](result("alpha-infra"));
  await first;
  void store.run();
  expect(store.get()).toEqual({ result: result("alpha-infra"), running: true });
});

test("the overview's runs never pass roots: the server uses the saved ones, never a Settings draft", async () => {
  const { discover, pending, calls } = controlled();
  const store = createDiscoveryStore(discover);
  const run = store.run();
  pending[0](result("beta-soc"));
  await run;
  expect(calls).toEqual([[]]);
});

test("a failed run keeps the last result and says why; clear forgets everything and outruns a pending run", async () => {
  let fail = false;
  const store = createDiscoveryStore(async () => {
    if (fail) throw new Error("server unreachable");
    return result("demo-ops");
  });
  await store.run();
  fail = true;
  await store.run();
  expect(store.get()).toEqual({ result: result("demo-ops"), running: false, error: "server unreachable" });

  const { discover, pending } = controlled();
  const other = createDiscoveryStore(discover);
  let notified = 0;
  other.subscribe(() => notified++);
  const late = other.run();
  other.clear();
  pending[0](result("late"));
  await late;
  expect(other.get()).toEqual({ running: false });
  expect(notified).toBe(2);
});

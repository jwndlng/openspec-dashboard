import { expect, test } from "bun:test";
import { ACTIVITY_SEEN_KEY } from "../src/ui/activityState.ts";
import { AUTO_REFRESH_STORAGE_KEY } from "../src/ui/autoRefresh.ts";
import { GROUP_STATE_STORAGE_KEY } from "../src/ui/groupState.ts";
import { migrateStorage, STORAGE_MIGRATED_KEY } from "../src/ui/storage.ts";
import { THEME_STORAGE_KEY } from "../src/ui/theme.ts";
import { TOUR_STORAGE_KEY } from "../src/ui/tourState.ts";
import { WHATS_NEW_SEEN_KEY } from "../src/ui/whatsNewState.ts";

/** A Storage with the methods the copy uses, in insertion order like a browser's. */
function memory(initial: Record<string, string> = {}): Storage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

test("every key the UI keeps uses the spec-control prefix", () => {
  expect([THEME_STORAGE_KEY, TOUR_STORAGE_KEY, GROUP_STATE_STORAGE_KEY, AUTO_REFRESH_STORAGE_KEY, WHATS_NEW_SEEN_KEY, ACTIVITY_SEEN_KEY]).toEqual([
    "spec-control.theme",
    "spec-control.tour",
    "spec-control.groups.v1",
    "spec-control.autoRefresh",
    "spec-control.whats-new.seen",
    "spec-control.activity.seen",
  ]);
});

test("former keys are copied once and kept", () => {
  const store = memory({ "openspec-dashboard.theme": "light", "openspec-dashboard.tour": "seen", "unrelated.key": "x" });
  migrateStorage(store);
  expect(store.getItem(THEME_STORAGE_KEY)).toBe("light");
  expect(store.getItem(TOUR_STORAGE_KEY)).toBe("seen");
  expect(store.getItem("openspec-dashboard.theme")).toBe("light");
  expect(store.getItem("spec-control.key")).toBeNull();
  expect(store.getItem(STORAGE_MIGRATED_KEY)).toBe("1");
});

test("a value under the new key wins over the former one", () => {
  const store = memory({ "openspec-dashboard.autoRefresh": "5s", [AUTO_REFRESH_STORAGE_KEY]: "30s" });
  migrateStorage(store);
  expect(store.getItem(AUTO_REFRESH_STORAGE_KEY)).toBe("30s");
});

test("after the copy, a removed preference is not brought back", () => {
  const store = memory({ "openspec-dashboard.theme": "light" });
  migrateStorage(store);
  store.removeItem(THEME_STORAGE_KEY); // the user picked `system`
  migrateStorage(store); // the next page load
  expect(store.getItem(THEME_STORAGE_KEY)).toBeNull();
});

test("nothing stored: only the record of the copy is written", () => {
  const store = memory();
  migrateStorage(store);
  expect([...store.data.keys()]).toEqual([STORAGE_MIGRATED_KEY]);
});

test("storage that throws is tolerated", () => {
  const throwing = {
    ...memory(),
    getItem: () => {
      throw new Error("SecurityError");
    },
  } as Storage;
  expect(() => migrateStorage(throwing)).not.toThrow();
  // Without a localStorage at all (bun has none), the default is tolerated too.
  expect(() => migrateStorage()).not.toThrow();
});

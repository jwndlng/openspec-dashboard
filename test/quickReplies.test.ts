import { expect, test } from "bun:test";
import { DEFAULT_SHORTCUTS } from "../src/shared/agentDefaults.ts";
import { buildSample } from "../src/ui/demo/sampleData.ts";
import type { Shortcut } from "../src/shared/types.ts";
import { defaultConfig, validateConfig } from "../src/server/config.ts";
import { addShortcut, moveShortcut, NOT_SUBMITTED_NOTICE, removeShortcut, restoredShortcuts, shortcutHint, shortcutMessage, visibleShortcuts } from "../src/ui/quickReplies.ts";

const isControl = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
};

const shortcut = (id: string, title: string, prompt: string): Shortcut => ({ id, title, prompt });

test("a shortcut is sent with one click: a submit message carrying exactly its prompt", () => {
  for (const s of DEFAULT_SHORTCUTS) expect(shortcutMessage(s)).toEqual({ type: "submit", data: s.prompt });
  const ship = shortcut("ship", "Ship it", "Commit the work, push the branch and open a pull request.");
  expect(shortcutMessage(ship)).toEqual({ type: "submit", data: ship.prompt });
});

test("the title is never sent, however different it is from the prompt", () => {
  const ship = shortcut("ship", "Ship it", "Commit the work, push the branch and open a pull request.");
  expect(shortcutMessage(ship).data).not.toContain("Ship it");
});

test("the browser never adds Enter or any other control character: pressing Enter is the server's decision", () => {
  for (const s of DEFAULT_SHORTCUTS) expect([...shortcutMessage(s).data].some(isControl)).toBe(false);
});

test("the hint quotes the prompt, not the title", () => {
  expect(shortcutHint(shortcut("ship", "Ship it", "Open a pull request."))).toBe('sends "Open a pull request."');
  for (const s of DEFAULT_SHORTCUTS) expect(shortcutHint(s)).toBe(`sends "${s.prompt}"`);
});

const configWith = (shortcuts: Shortcut[]) => {
  const cfg = defaultConfig();
  return { ...cfg, agentSessions: { ...cfg.agentSessions, shortcuts } };
};

test("the row offers the configured shortcuts, in their order, and only while running and connected", () => {
  const mine = [shortcut("review", "Review", "Review your own diff."), shortcut("ship", "Ship it", "Open a pull request.")];
  const config = configWith(mine);
  expect(visibleShortcuts(config, true, true)).toEqual(mine);
  expect(visibleShortcuts(config, false, true)).toEqual([]);
  expect(visibleShortcuts(config, true, false)).toEqual([]);
  expect(visibleShortcuts(config, false, false)).toEqual([]);
});

test("nothing configured means no row at all, and so does a configuration that has not loaded yet", () => {
  expect(visibleShortcuts(configWith([]), true, true)).toEqual([]);
  expect(visibleShortcuts(null, true, true)).toEqual([]);
  expect(visibleShortcuts(undefined, true, true)).toEqual([]);
});

test("one list for every kind of session: the panel is given no session to vary by", () => {
  // `TerminalView` renders the row for a change's console, the main console and an Integrate session alike, and decides
  // it from the configuration only — a session cannot be passed in, so none of them can be offered something else.
  expect(visibleShortcuts.length).toBe(3);
  // The demo's own configuration, the one its console, Integrate panel and change panels all read. Its repository ids
  // are fictional, so only the rest of it goes through the real schema.
  const demo = buildSample(Date.parse("2026-09-23T12:00:00Z")).config;
  expect(visibleShortcuts(demo, true, true)).toEqual([...DEFAULT_SHORTCUTS]);
  expect(validateConfig({ ...demo, repos: [] }).agentSessions.shortcuts).toEqual([...DEFAULT_SHORTCUTS]);
});

test("the shipped configuration offers the four defaults, in their order", () => {
  expect(visibleShortcuts(defaultConfig(), true, true)).toEqual([...DEFAULT_SHORTCUTS]);
});

test("moving a shortcut reorders within the list and does nothing at either end", () => {
  const list = [shortcut("a", "A", "a"), shortcut("b", "B", "b"), shortcut("c", "C", "c")];
  const ids = (l: readonly Shortcut[]) => l.map((s) => s.id);
  expect(ids(moveShortcut(list, 2, -1))).toEqual(["a", "c", "b"]);
  expect(ids(moveShortcut(list, 0, 1))).toEqual(["b", "a", "c"]);
  expect(ids(moveShortcut(list, 0, -1))).toEqual(["a", "b", "c"]);
  expect(ids(moveShortcut(list, 2, 1))).toEqual(["a", "b", "c"]);
  expect(ids(moveShortcut(list, 5, -1))).toEqual(["a", "b", "c"]);
  // The list handed in is never mutated: the editor's draft is replaced, not edited in place.
  expect(ids(list)).toEqual(["a", "b", "c"]);
});

test("the editor's list operations: add appends with a unique id, remove keeps the order, restore gives the defaults", () => {
  const start = restoredShortcuts();
  expect(start).toEqual([...DEFAULT_SHORTCUTS]);
  // A fresh, editable copy each time: editing the draft must never reach the shipped constant.
  start[0].title = "edited";
  expect(restoredShortcuts()[0].title).toBe("Yes, go ahead");

  const added = addShortcut(restoredShortcuts());
  expect(added.length).toBe(DEFAULT_SHORTCUTS.length + 1);
  expect(added.at(-1)?.prompt).toBe("");
  expect(new Set(added.map((s) => s.id)).size).toBe(added.length);
  expect(new Set(addShortcut(added).map((s) => s.id)).size).toBe(added.length + 1);
  // An id already taken is not handed out twice, whatever it is.
  expect(addShortcut([shortcut("shortcut", "Mine", "x")]).at(-1)?.id).not.toBe("shortcut");

  const removed = removeShortcut(restoredShortcuts(), "create-pr");
  expect(removed.map((s) => s.id)).toEqual(["go-ahead", "resolve-conflicts", "stop"]);
  expect(removeShortcut(removed, "nope").map((s) => s.id)).toEqual(removed.map((s) => s.id));
  // Emptying the list is a state the editor can reach, and an empty draft is what hides the row.
  expect(restoredShortcuts().reduce((list, s) => removeShortcut(list, s.id), restoredShortcuts())).toEqual([]);
  expect(visibleShortcuts(configWith([]), true, true)).toEqual([]);
});

test("the notice says that nothing was confirmed", () => {
  expect(NOT_SUBMITTED_NOTICE).toContain("typed but not sent");
  expect(NOT_SUBMITTED_NOTICE).toContain("nothing was confirmed");
});

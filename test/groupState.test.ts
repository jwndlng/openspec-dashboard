import { expect, test } from "bun:test";
import { defaultMinimized, isMinimized, parseGroupState, pruneGroupState, serializeGroupState, toggleGroup } from "../src/ui/groupState.ts";

test("only Archived groups are minimized by default", () => {
  expect(defaultMinimized("Archived")).toBe(true);
  for (const column of ["Backlog", "Drafts", "Ready", "Implementing", "Done", "Unknown"]) expect(defaultMinimized(column)).toBe(false);
  expect(isMinimized({}, "r1", "Archived")).toBe(true);
  expect(isMinimized({}, "r1", "Ready")).toBe(false);
});

test("toggling stores a deviation and toggling back removes it", () => {
  const minimized = toggleGroup({}, "r1", "Ready");
  expect(minimized).toEqual({ "r1|Ready": true });
  expect(isMinimized(minimized, "r1", "Ready")).toBe(true);
  expect(toggleGroup(minimized, "r1", "Ready")).toEqual({});

  const expanded = toggleGroup({}, "r1", "Archived");
  expect(expanded).toEqual({ "r1|Archived": false });
  expect(isMinimized(expanded, "r1", "Archived")).toBe(false);
  expect(toggleGroup(expanded, "r1", "Archived")).toEqual({});
});

test("state is per repository and column, and toggling does not mutate its input", () => {
  const before = { "r1|Ready": true };
  const after = toggleGroup(before, "r1", "Implementing");
  expect(before).toEqual({ "r1|Ready": true });
  expect(after).toEqual({ "r1|Ready": true, "r1|Implementing": true });
  expect(isMinimized(after, "r2", "Ready")).toBe(false);
  expect(isMinimized(after, "r1", "Done")).toBe(false);
});

test("parse is tolerant of missing, malformed and foreign values", () => {
  expect(parseGroupState(null)).toEqual({});
  expect(parseGroupState("")).toEqual({});
  expect(parseGroupState("{nope")).toEqual({});
  expect(parseGroupState("[true]")).toEqual({});
  expect(parseGroupState('"text"')).toEqual({});
  expect(parseGroupState("null")).toEqual({});
  expect(parseGroupState('{"r1|Ready":true,"r2|Archived":"yes","nokey":true,"|Ready":false,"r3|Done":false}')).toEqual({ "r1|Ready": true, "r3|Done": false });
});

test("serialize and parse round-trip", () => {
  const overrides = { "r1|Ready": true, "r2|Archived": false };
  expect(parseGroupState(serializeGroupState(overrides))).toEqual(overrides);
});

test("prune drops repositories that are no longer tracked", () => {
  const overrides = { "r1|Ready": true, "gone|Archived": false, "r2|Archived": false };
  expect(pruneGroupState(overrides, ["r1", "r2", "r3"])).toEqual({ "r1|Ready": true, "r2|Archived": false });
  expect(pruneGroupState(overrides, [])).toEqual({});
});

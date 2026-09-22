import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { canonicalPath } from "../src/server/paths.ts";
import { tempDir } from "./helpers.ts";

let root: string;
let caseInsensitive: boolean;

beforeAll(async () => {
  root = realpathSync.native(await tempDir());
  await mkdir(join(root, "Foo", "Bar"), { recursive: true });
  await symlink(join(root, "Foo"), join(root, "link"));
  caseInsensitive = existsSync(join(root, "foo"));
});
afterAll(() => rm(root, { recursive: true, force: true }));

// Pins the assumption `canonicalPath` rests on: under Bun the native realpath reports on-disk casing.
test("native realpath returns the on-disk casing on a case-insensitive volume", () => {
  if (!caseInsensitive) return; // case-sensitive volume: `foo` does not exist
  expect(realpathSync.native(join(root, "foo", "bar"))).toBe(join(root, "Foo", "Bar"));
});

test("expands ~", () => {
  expect(canonicalPath("~")).toBe(realpathSync.native(homedir()));
  expect(canonicalPath("~/no-such-dir-osd")).toBe(join(homedir(), "no-such-dir-osd"));
});

test("strips a trailing slash and resolves . segments", () => {
  expect(canonicalPath(`${join(root, "Foo")}/`)).toBe(join(root, "Foo"));
  expect(canonicalPath(`${root}/./Foo/../Foo/Bar/`)).toBe(join(root, "Foo", "Bar"));
  expect(canonicalPath("/")).toBe("/");
});

test("resolves a symlinked directory", () => {
  expect(canonicalPath(join(root, "link", "Bar"))).toBe(join(root, "Foo", "Bar"));
});

test("case variant resolves to the on-disk spelling", () => {
  if (!caseInsensitive) return;
  expect(canonicalPath(join(root, "foo", "BAR"))).toBe(join(root, "Foo", "Bar"));
});

test("a path that does not exist is returned normalised", () => {
  expect(canonicalPath(join(root, "gone", ".", "repo/"))).toBe(join(root, "gone", "repo"));
  expect(canonicalPath("relative/./dir")).toBe("relative/dir");
  expect(canonicalPath("src")).toBe("src"); // exists below the working directory, still not resolved
});

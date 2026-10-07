import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { canonicalPath, consoleDir, dashboardHome, explicitHome, mergeScratchDir, useFallbackHome } from "../src/server/paths.ts";
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

/** Runs `fn` with exactly these home variables set (undefined unsets), restoring both afterwards. */
function withHomeEnv(env: { SPEC_CONTROL_HOME?: string; OPENSPEC_DASHBOARD_HOME?: string }, fn: () => void): void {
  const names = ["SPEC_CONTROL_HOME", "OPENSPEC_DASHBOARD_HOME"] as const;
  const previous = names.map((n) => process.env[n]);
  for (const n of names) {
    if (env[n] === undefined) delete process.env[n];
    else process.env[n] = env[n];
  }
  try {
    fn();
  } finally {
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n];
      else process.env[n] = previous[i];
    });
    useFallbackHome(undefined);
  }
}

test("the console's default folder lives in the dashboard home and follows SPEC_CONTROL_HOME", () => {
  withHomeEnv({ SPEC_CONTROL_HOME: "/w/acme/.dash" }, () => expect(consoleDir()).toBe("/w/acme/.dash/console"));
});

test("the merge scratch store lives in the dashboard home and follows SPEC_CONTROL_HOME", () => {
  // Never inside a repository: the conflict check would otherwise write into the tree it is meant to only read.
  withHomeEnv({ SPEC_CONTROL_HOME: "/w/acme/.dash" }, () => expect(mergeScratchDir()).toBe("/w/acme/.dash/merge-scratch"));
});

test("the home defaults to ~/.spec-control", () => {
  withHomeEnv({}, () => {
    expect(dashboardHome()).toBe(join(homedir(), ".spec-control"));
    expect(explicitHome()).toBeUndefined();
  });
});

test("SPEC_CONTROL_HOME wins over the deprecated OPENSPEC_DASHBOARD_HOME", () => {
  withHomeEnv({ SPEC_CONTROL_HOME: "/w/state/a", OPENSPEC_DASHBOARD_HOME: "/w/state/b" }, () => {
    expect(dashboardHome()).toBe("/w/state/a");
    expect(explicitHome()?.variable).toBe("SPEC_CONTROL_HOME");
  });
});

test("OPENSPEC_DASHBOARD_HOME still works on its own", () => {
  withHomeEnv({ OPENSPEC_DASHBOARD_HOME: "/w/state/b" }, () => {
    expect(dashboardHome()).toBe("/w/state/b");
    expect(explicitHome()?.variable).toBe("OPENSPEC_DASHBOARD_HOME");
  });
});

test("an empty variable counts as unset", () => {
  withHomeEnv({ SPEC_CONTROL_HOME: "", OPENSPEC_DASHBOARD_HOME: "/w/state/b" }, () => expect(dashboardHome()).toBe("/w/state/b"));
  withHomeEnv({ SPEC_CONTROL_HOME: "", OPENSPEC_DASHBOARD_HOME: "" }, () => expect(dashboardHome()).toBe(join(homedir(), ".spec-control")));
});

test("a failed migration's fallback is used only without an explicit home", () => {
  withHomeEnv({}, () => {
    useFallbackHome("/w/old-home");
    expect(dashboardHome()).toBe("/w/old-home");
  });
  withHomeEnv({ SPEC_CONTROL_HOME: "/w/state/a" }, () => {
    useFallbackHome("/w/old-home");
    expect(dashboardHome()).toBe("/w/state/a");
  });
});

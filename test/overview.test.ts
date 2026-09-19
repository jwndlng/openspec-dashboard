import { expect, test } from "bun:test";
import type { ChangeSnapshot, Config, RepoSnapshot, Snapshot } from "../src/shared/types.ts";
import { cdCommand } from "../src/ui/format.ts";
import { enabledOnly, filterRows, overviewRows, parseOverviewState, serializeOverviewState, sortRows, toggleSort } from "../src/ui/overviewState.ts";
import { repoPath, routeFromPath } from "../src/ui/routes.ts";

function change(repoId: string, name: string, column: string, extra: Partial<ChangeSnapshot> = {}): ChangeSnapshot {
  const stage = column === "Done" ? "done" : column === "Synced" ? "synced" : column === "Archived" ? "archived" : column === "Implementing" ? "implementing" : "artifact";
  return { repoId, name, schema: "spec-driven", artifacts: [], tasks: null, stage, column, ...extra };
}

function repo(id: string, name: string, changes: ChangeSnapshot[], extra: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return { id, name, path: `/w/${name}`, ok: true, scannedAt: "2026-09-19T00:00:00Z", isGit: true, worktrees: [], changes, ...extra };
}

const snapshot: Snapshot = {
  generatedAt: "2026-09-19T00:00:00Z",
  repos: [
    repo(
      "a",
      "alpha-infra",
      [
        change("a", "s1", "Specs"),
        ...Array.from({ length: 9 }, (_, i) => change("a", `i${i}`, "Implementing")),
        change("a", "d1", "Done"),
        change("a", "d2", "Synced"),
        change("a", "old", "Archived", { archived: "2026-01-01" }),
      ],
      { lastUpdatedAt: "2026-09-18T10:00:00+02:00" },
    ),
    repo("b", "beta-soc", [change("b", "x", "Proposal", { lastActivityAt: "2026-07-01T00:00:00Z" }), change("b", "y", "Specs", { lastActivityAt: "2026-07-10T00:00:00Z" })]),
    repo("c", "Fit", [change("c", "gone", "Archived", { archived: "2026-02-02" })], { lastUpdatedAt: "2026-09-19T08:00:00Z" }),
    repo("d", "broken", [], { ok: false, error: "repository path or its openspec/ directory does not exist" }),
  ],
};

test("routeFromPath covers every view, trailing slashes, encoded ids and unknown paths", () => {
  expect(routeFromPath("/")).toEqual({ view: "overview" });
  expect(routeFromPath("")).toEqual({ view: "overview" });
  expect(routeFromPath("/board/")).toEqual({ view: "board" });
  expect(routeFromPath("/settings")).toEqual({ view: "settings" });
  expect(routeFromPath("/repo/abc123")).toEqual({ view: "repo", repoId: "abc123" });
  expect(routeFromPath("/repo/a%20b/")).toEqual({ view: "repo", repoId: "a b" });
  expect(routeFromPath(repoPath("a/b"))).toEqual({ view: "repo", repoId: "a/b" });
  expect(routeFromPath("/repo/%E0%A4%A")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/a/extra")).toEqual({ view: "overview" });
  expect(routeFromPath("/nope")).toEqual({ view: "overview" });
});

test("overview URL state omits defaults and survives a round trip", () => {
  expect(parseOverviewState("")).toEqual({ sort: "updated", dir: "desc", q: "" });
  expect(serializeOverviewState({ sort: "updated", dir: "desc", q: "" })).toBe("");
  expect(parseOverviewState("?sort=open")).toEqual({ sort: "open", dir: "desc", q: "" });
  expect(parseOverviewState("?sort=name")).toEqual({ sort: "name", dir: "asc", q: "" });
  expect(serializeOverviewState({ sort: "archive", dir: "desc", q: "" })).toBe("?sort=archive");
  expect(serializeOverviewState({ sort: "name", dir: "desc", q: "ops" })).toBe("?sort=name&dir=desc&q=ops");
  expect(parseOverviewState("?sort=name&dir=desc&q=ops")).toEqual({ sort: "name", dir: "desc", q: "ops" });
  expect(parseOverviewState("?sort=bogus&dir=sideways&repos=a")).toEqual({ sort: "updated", dir: "desc", q: "" });
});

test("toggleSort flips the active key and starts a new key in its natural direction", () => {
  const byName = toggleSort({ sort: "updated", dir: "desc", q: "x" }, "name");
  expect(byName).toEqual({ sort: "name", dir: "asc", q: "x" });
  expect(toggleSort(byName, "name")).toEqual({ sort: "name", dir: "desc", q: "x" });
});

test("overviewRows counts open changes per column and falls back to change activity", () => {
  const [aws, soc, fit, broken] = overviewRows(snapshot);
  expect(aws.stageCounts).toEqual({ Specs: 1, Implementing: 9, Done: 1, Synced: 1 });
  expect([aws.open, aws.toArchive, aws.archived]).toEqual([12, 2, 1]);
  expect(soc.lastUpdatedAt).toBe("2026-07-10T00:00:00Z");
  expect([fit.open, fit.archived]).toEqual([0, 1]);
  expect(broken.ok).toBe(false);
  expect(broken.error).toContain("does not exist");
  expect(broken.lastUpdatedAt).toBeUndefined();
});

test("sortRows: newest first by default, undated last in both directions, ties by name", () => {
  const rows = overviewRows(snapshot);
  const names = (sort: Parameters<typeof sortRows>[1], dir: Parameters<typeof sortRows>[2]) => sortRows(rows, sort, dir).map((r) => r.name);
  expect(names("updated", "desc")).toEqual(["Fit", "alpha-infra", "beta-soc", "broken"]);
  expect(names("updated", "asc")).toEqual(["beta-soc", "alpha-infra", "Fit", "broken"]);
  expect(names("name", "asc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
  expect(names("open", "desc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
  expect(names("archive", "desc")).toEqual(["alpha-infra", "beta-soc", "broken", "Fit"]);
});

test("filterRows matches repository names case-insensitively", () => {
  const rows = overviewRows(snapshot);
  expect(filterRows(rows, " FIT ").map((r) => r.name)).toEqual(["Fit"]);
  expect(filterRows(rows, "")).toHaveLength(4);
});

test("cdCommand shell-quotes paths that need it", () => {
  expect(cdCommand("/Users/x/Workspace/foo")).toBe("cd /Users/x/Workspace/foo");
  expect(cdCommand("/Users/x/My Repos/foo")).toBe("cd '/Users/x/My Repos/foo'");
});

test("enabledOnly drops repositories the config no longer enables, before any rescan", () => {
  const config: Config = {
    version: 1,
    scanRoots: [],
    pollIntervalSeconds: 60,
    port: 4711,
    repos: [
      { id: "a", path: "/w/alpha-infra", name: "alpha-infra", enabled: true },
      { id: "b", path: "/w/beta-soc", name: "beta-soc", enabled: false },
    ],
  };
  // "c" and "d" are not in the config at all (forgotten), "b" was just disabled.
  expect(enabledOnly(snapshot, config)?.repos.map((r) => r.id)).toEqual(["a"]);
  expect(enabledOnly(snapshot, config)?.generatedAt).toBe(snapshot.generatedAt);
  expect(enabledOnly(snapshot, null)).toBe(snapshot);
  expect(enabledOnly(null, config)).toBeNull();
});

test("same-named repositories get the shortest distinguishing parent path as a hint", () => {
  const at = (id: string, name: string, path: string) => ({ ...repo(id, name, []), path });
  const rows = overviewRows({
    generatedAt: "2026-09-19T00:00:00Z",
    repos: [
      at("1", "chat-groups", "/w/acme/chat-groups"),
      at("2", "chat-groups", "/w/ops/repo-mirror/repos/chat-groups"),
      at("3", "foo", "/a/x/repos/foo"),
      at("4", "Foo", "/a/y/repos/foo"),
      at("5", "foo", "/a/z/other/foo"),
      at("6", "alpha-infra", "/w/acme/alpha-infra"),
    ],
  });
  expect(rows.map((r) => r.hint)).toEqual(["acme", "repos", "x/repos", "y/repos", "other", undefined]);
  expect(filterRows(rows, "repo-mir")).toHaveLength(0);
  expect(filterRows(rows, "y/rep").map((r) => r.id)).toEqual(["4"]);
  expect(new Set(rows.map((r) => r.id)).size).toBe(6);
});

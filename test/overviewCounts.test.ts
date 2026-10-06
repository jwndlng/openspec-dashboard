// project-overview: "Overview rows summarise each repository" — totals only; the per-stage breakdown is on the boards.
import { expect, test } from "bun:test";
import type { ChangeSnapshot, RepoSnapshot } from "../src/shared/types.ts";
import { Row, Tile } from "../src/ui/overview.tsx";
import { overviewRows } from "../src/ui/overviewState.ts";
import type { Tracking } from "../src/ui/untracked.tsx";
import { byTag, elements, textOf } from "./vnode.ts";

const change = (name: string, column: string, stage: ChangeSnapshot["stage"]): ChangeSnapshot => ({ repoId: "a", name, schema: "spec-driven", artifacts: [], tasks: null, stage, column });
const repo: RepoSnapshot = {
  id: "a",
  name: "alpha-infra",
  path: "/w/acme/alpha-infra",
  ok: true,
  scannedAt: "2026-10-01T00:00:00Z",
  isGit: true,
  worktrees: [],
  changes: [
    change("s1", "Drafts", "drafts"),
    ...Array.from({ length: 9 }, (_, i) => change(`i${i}`, "Implementing", "implementing")),
    change("d1", "Done", "done"),
    change("d2", "Done", "done"),
  ],
};
const [row] = overviewRows({ generatedAt: "2026-10-01T00:00:00Z", repos: [repo] });
const tracking = {} as Tracking;
const STAGES = ["Backlog", "Drafts", "Ready", "Implementing", "Done"];

test("a row shows the open and to-archive totals and no count per stage", () => {
  const node = Row({ row, now: 0, tracking });
  const cells = byTag(node, "td").map(textOf);
  expect(cells[0]).toBe("12");
  expect(cells[1]).toBe("2 to archive");
  // The name cell, the two totals, PRs, work in progress, updated, agent sessions and actions: no stage cells.
  expect(cells).toHaveLength(7);
  for (const stage of STAGES) expect(textOf(node)).not.toContain(stage);
});

test("an idle row's placeholder spans just the two totals", () => {
  const [idle] = overviewRows({ generatedAt: "2026-10-01T00:00:00Z", repos: [{ ...repo, changes: [] }] });
  const none = byTag(Row({ row: idle, now: 0, tracking }), "td")[0];
  expect(textOf(none)).toBe("no open changes");
  expect(none.props.colSpan).toBe(2);
});

test("a tile shows the totals and no stage strip", () => {
  const node = Tile({ row, now: 0, tracking });
  expect(textOf(node)).toContain("12 open");
  expect(textOf(node)).toContain("2 to archive");
  expect(elements(node).filter((e) => String(e.props.class ?? "").includes("stage-strip"))).toHaveLength(0);
  for (const stage of STAGES) expect(textOf(node)).not.toContain(stage);
});

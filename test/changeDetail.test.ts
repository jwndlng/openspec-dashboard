import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeArtifactEntry, ChangeSnapshot, RepoSnapshot } from "../src/shared/types.ts";
import { ApiError } from "../src/ui/api.ts";
import {
  ArtifactTabs,
  absoluteFilePath,
  artifactLabel,
  ChangeNotFound,
  DetailHeader,
  FileContent,
  FileList,
  type FileState,
  fileFailure,
  nextFileState,
  nextListing,
  resolveSelection,
  taskProgress,
} from "../src/ui/changeDetail.tsx";
import { type Card, ChangeCard, CopyButton, cardLink, Meter } from "../src/ui/kanban.tsx";
import { renderMarkdown } from "../src/ui/markdown.tsx";
import { backTarget, parseDetailQuery, routeFromPath } from "../src/ui/routes.ts";
import { FIXTURES } from "./helpers.ts";
import { byComponent, byTag, elements, textOf } from "./vnode.ts";

const NOW = Date.parse("2026-03-10T12:00:00Z");
const change: ChangeSnapshot = {
  repoId: "r1",
  name: "multi-tenant-sync",
  schema: "spec-driven",
  artifacts: [],
  tasks: { done: 4, total: 12 },
  created: "2026-03-02",
  lastActivityAt: "2026-03-07T12:00:00Z",
  branchMatch: "feat/multi-tenant-sync",
  stage: "implementing",
  column: "Implementing",
  warnings: ["could not read artifacts: unknown schema 'custom'"],
};
const repo: RepoSnapshot = { id: "r1", name: "forum-admin", path: "/w/acme/forum-admin", ok: true, scannedAt: "2026-03-10T12:00:00Z", isGit: true, worktrees: [], changes: [change] };
const DIR = "/w/acme/forum-admin/openspec/changes/multi-tenant-sync";

const artifacts: ChangeArtifactEntry[] = [
  { id: "proposal", status: "done", files: [{ path: "proposal.md", bytes: 10 }] },
  { id: "specs", status: "done", files: [{ path: "specs/dashboard-api/spec.md", bytes: 10 }, { path: "specs/kanban-board/spec.md", bytes: 10 }] },
  { id: "design", status: "ready", files: [] },
  { id: "tasks", status: "blocked", files: [] },
];

const copyTexts = (node: Parameters<typeof elements>[0]) => Object.fromEntries(byComponent(node, CopyButton).map((b) => [b.props.label as string, b.props.text as string]));
const classed = (node: Parameters<typeof elements>[0], cls: string) => elements(node).filter((el) => String(el.props.class ?? "").split(" ").includes(cls));

test("header: name, repository link, column, progress, age, dates, branch, warnings", () => {
  const header = DetailHeader({ repo, change, selectedFilePath: undefined, now: NOW });
  expect(textOf(classed(header, "change-name")[0])).toBe("multi-tenant-sync");
  const links = byTag(header, "a");
  expect(links.map((a) => [textOf(a).trim(), a.props.href])).toEqual([["← Back to board", "/repo/r1"], ["forum-admin", "/repo/r1"]]);
  const text = textOf(header);
  expect(text).toContain("Implementing");
  expect(text).toContain("4/12");
  expect(text).toContain("3d ago");
  expect(text).toContain("created 2026-03-02");
  expect(text).not.toContain("archived");
  expect(text).toContain("could not read artifacts: unknown schema 'custom'");
  expect(byComponent(header, Meter).length + classed(header, "meter").length).toBeGreaterThan(0);
  expect(elements(header).some((el) => el.props["aria-label"] === "branch feat/multi-tenant-sync")).toBe(true);

  const archived = DetailHeader({ repo, change: { ...change, archived: "2026-03-09", column: "Archived", tasks: null, branchMatch: undefined, warnings: undefined }, now: NOW });
  expect(textOf(archived)).toContain("archived 2026-03-09");
  expect(classed(archived, "meter")).toEqual([]);
});

test("copy actions: exact clipboard text for apply, cd and the selected file", () => {
  const filePath = absoluteFilePath(DIR, "specs/kanban-board/spec.md");
  expect(filePath).toBe("/w/acme/forum-admin/openspec/changes/multi-tenant-sync/specs/kanban-board/spec.md");
  expect(copyTexts(DetailHeader({ repo, change, selectedFilePath: filePath, now: NOW }))).toEqual({
    "Copy apply command": 'cd /w/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"',
    "Copy cd command": "cd /w/acme/forum-admin",
    "Copy file path": filePath,
  });
  // nothing selected: no file action; archived: nothing to apply
  expect(Object.keys(copyTexts(DetailHeader({ repo, change: { ...change, archived: "2026-03-09" }, now: NOW })))).toEqual(["Copy cd command"]);
});

test("back link follows a board `from`, ignores anything else", () => {
  const back = (from?: string) => byTag(DetailHeader({ repo, change, from, now: NOW }), "a")[0].props.href;
  expect(back("/board?q=sync")).toBe("/board?q=sync");
  expect(back("https://example.com/")).toBe("/repo/r1");
  expect(back(undefined)).toBe("/repo/r1");
});

test("not found names what was asked for and links to the overview", () => {
  const unknownChange = ChangeNotFound({ repo, repoId: "r1", changeName: "gone-away" });
  expect(textOf(unknownChange)).toContain("forum-admin");
  expect(textOf(unknownChange)).toContain("gone-away");
  expect(byTag(unknownChange, "a")[0].props.href).toBe("/");
  const unknownRepo = ChangeNotFound({ repoId: "nope", changeName: "gone-away" });
  expect(textOf(unknownRepo)).toContain("nope");
  expect(textOf(unknownRepo)).toContain("gone-away");
});

test("tabs: schema order, state on every tab, artifacts without files not selectable", () => {
  const picked: string[] = [];
  const tabs = byTag(ArtifactTabs({ artifacts, selected: "specs", onSelect: (id) => picked.push(id) }), "button");
  expect(tabs.map((t) => textOf(t))).toEqual(["Proposaldone", "Specsdone", "Designready", "Tasksblocked"]);
  expect(tabs.map((t) => t.props.disabled)).toEqual([false, false, true, true]);
  expect(tabs.map((t) => t.props["aria-selected"])).toEqual([false, true, false, false]);
  (tabs[0].props.onClick as () => void)();
  expect(picked).toEqual(["proposal"]);
  expect(artifactLabel("release-notes")).toBe("Release notes");
});

test("selection: URL wins when it exists, stale artifact or file falls back without an error", () => {
  expect(resolveSelection(artifacts, {})).toEqual({ artifactId: "proposal", file: "proposal.md" });
  expect(resolveSelection(artifacts, { artifact: "specs" })).toEqual({ artifactId: "specs", file: "specs/dashboard-api/spec.md" });
  expect(resolveSelection(artifacts, { artifact: "specs", file: "specs/kanban-board/spec.md" })).toEqual({ artifactId: "specs", file: "specs/kanban-board/spec.md" });
  expect(resolveSelection(artifacts, { artifact: "specs", file: "specs/gone/spec.md" })).toEqual({ artifactId: "specs", file: "specs/dashboard-api/spec.md" });
  expect(resolveSelection(artifacts, { artifact: "design" })).toEqual({ artifactId: "proposal", file: "proposal.md" }); // exists, but has no file
  expect(resolveSelection(artifacts, { artifact: "nope", file: "../../etc/passwd" })).toEqual({ artifactId: "proposal", file: "proposal.md" });
  expect(resolveSelection(artifacts.map((a) => ({ ...a, files: [] })), { artifact: "specs" })).toEqual({});
  expect(resolveSelection([], {})).toEqual({});
});

test("file list only for multi-file artifacts, first file selected by default", () => {
  expect(FileList({ artifact: artifacts[0], selected: "proposal.md", onSelect: () => {} })).toBeNull();
  const picked: string[] = [];
  const selected = resolveSelection(artifacts, { artifact: "specs" }).file;
  const buttons = byTag(FileList({ artifact: artifacts[1], selected, onSelect: (p) => picked.push(p) }), "button");
  expect(buttons.map((b) => [textOf(b), b.props["aria-current"]])).toEqual([["specs/dashboard-api/spec.md", "true"], ["specs/kanban-board/spec.md", undefined]]);
  (buttons[1].props.onClick as () => void)();
  expect(picked).toEqual(["specs/kanban-board/spec.md"]);
});

test("tasks artifact: read-only checklist with done/total from the file on screen", () => {
  const text = readFileSync(join(FIXTURES, "demo-ops", "openspec", "changes", "cloud-deployment", "tasks.md"), "utf8");
  expect(taskProgress(text)).toEqual({ done: 4, total: 10 });
  expect(taskProgress("1. [X] a\n* [ ] b\n  - [x] c\nnot [x] a task")).toEqual({ done: 2, total: 3 });
  const view = FileContent({ state: { status: "ok", path: "tasks.md", text }, raw: false, isTasks: true, rendered: renderMarkdown(text) });
  expect(textOf(view)).toContain("4/10");
  const boxes = byTag(view, "input");
  expect(boxes.map((b) => b.props.checked)).toEqual([true, true, true, true, false, false, false, false, false, false]);
  // not operable: disabled, and no handler that could send anything
  for (const box of boxes) {
    expect(box.props.disabled).toBe(true);
    expect(Object.keys(box.props).filter((k) => k.startsWith("on"))).toEqual([]);
  }
  // other artifacts get no progress bar
  expect(textOf(FileContent({ state: { status: "ok", path: "proposal.md", text }, raw: false, isTasks: false, rendered: renderMarkdown(text) }))).not.toContain("4/10");
});

test("raw shows the source verbatim instead of the rendering", () => {
  const text = "## Why\n\n- [x] **done**\n";
  const raw = FileContent({ state: { status: "ok", path: "proposal.md", text }, raw: true, isTasks: false, rendered: renderMarkdown(text) });
  expect(byTag(raw, "pre").map(textOf)).toEqual([text]);
  expect(byTag(raw, "h2")).toEqual([]);
  // the toggle lives in the query, not per file: it survives selecting another file and a reload
  expect(parseDetailQuery("?artifact=specs&file=specs%2Fa%2Fspec.md&raw=1").raw).toBe(true);
});

test("error and oversize states stay inside the content area", () => {
  const tooLarge = fileFailure("huge.md", new ApiError(413, "file is larger than 1048576 bytes"));
  expect(tooLarge.status).toBe("too-large");
  const big = FileContent({ state: tooLarge, raw: false, isTasks: false, rendered: null, filePath: `${DIR}/huge.md` });
  expect(textOf(big)).toContain("too large to display");
  expect(copyTexts(big)).toEqual({ "Copy file path": `${DIR}/huge.md` });

  const gone = fileFailure("design.md", new ApiError(404, "no such file in this change"));
  expect(gone).toEqual({ status: "error", path: "design.md", message: "no such file in this change" });
  const view = FileContent({ state: gone, raw: false, isTasks: false, rendered: null });
  expect(textOf(view)).toBe("Could not read design.md: no such file in this change");
  expect(fileFailure("x.md", "offline").status).toBe("error");
});

test("an unchanged poll keeps the very same state objects, a changed one replaces them", () => {
  const shown: FileState = { status: "ok", path: "tasks.md", text: "- [ ] a\n" };
  expect(nextFileState(shown, { status: "ok", path: "tasks.md", text: "- [ ] a\n" })).toBe(shown);
  expect(nextFileState(shown, { status: "ok", path: "tasks.md", text: "- [x] a\n" })).not.toBe(shown);
  expect(nextFileState(shown, { status: "ok", path: "design.md", text: "- [ ] a\n" })).not.toBe(shown);
  const failed: FileState = { status: "error", path: "tasks.md", message: "boom" };
  expect(nextFileState(failed, { status: "error", path: "tasks.md", message: "boom" })).toBe(failed);
  expect(nextFileState(failed, shown)).toBe(shown);
  expect(nextFileState(null, shown)).toBe(shown);

  const listing = { change: { repoId: "r1", name: "x", schema: "spec-driven", dir: DIR, archived: false }, artifacts };
  expect(nextListing(listing, structuredClone(listing))).toBe(listing);
  const grown = structuredClone(listing);
  grown.artifacts[2].files.push({ path: "design.md", bytes: 5 }); // an artifact written on disk: its tab becomes selectable
  expect(nextListing(listing, grown)).toBe(grown);
});

const card: Card = { ...change, repoName: "forum-admin", repoPath: "/w/acme/forum-admin", hue: 120 };

test("a card is a real link to its change, carrying the board and its filters", () => {
  const link = cardLink(card, "/board?q=sync&archived=0");
  expect(link.path).toBe("/repo/r1/change/multi-tenant-sync");
  expect(routeFromPath(link.path)).toEqual({ view: "change", repoId: "r1", changeName: "multi-tenant-sync" });
  expect(backTarget(parseDetailQuery(link.query).from, "r1")).toEqual({ path: "/board", query: "?q=sync&archived=0" });

  for (const showRepo of [true, false]) {
    const view = ChangeCard({ card, now: NOW, showRepo, from: "/board?q=sync" });
    const anchors = byTag(view, "a");
    expect(anchors.map((a) => a.props.href)).toEqual(["/repo/r1/change/multi-tenant-sync?from=%2Fboard%3Fq%3Dsync"]);
    expect(textOf(anchors[0])).toBe("multi-tenant-sync");
  }
  const archived = ChangeCard({ card: { ...card, archived: "2026-03-09" }, now: NOW, showRepo: true, from: "/board" });
  expect(byTag(archived, "a").length).toBe(1);
});

test("controls on a card are outside its link, and the card's content is unchanged", () => {
  const view = ChangeCard({ card, now: NOW, showRepo: true, from: "/board" });
  const anchor = byTag(view, "a")[0];
  expect(elements(anchor.props.children)).toEqual([]); // just the name: no button, no session starter inside the anchor
  expect(copyTexts(view)).toEqual({ undefined: 'cd /w/acme/forum-admin && claude "/opsx:apply multi-tenant-sync"' });
  const text = textOf(view);
  for (const part of ["forum-admin", "multi-tenant-sync", "4/12", "3d ago"]) expect(text).toContain(part);
});

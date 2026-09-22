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
  closeOnEscape,
  DetailHeader,
  DetailOverlay,
  detailClose,
  FileContent,
  FileList,
  type FileState,
  fileFailure,
  nextFileState,
  nextListing,
  resolveSelection,
  taskProgress,
} from "../src/ui/changeDetail.tsx";
import { type Card, ChangeCard, CopyButton, cardLink, initialFilters } from "../src/ui/kanban.tsx";
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

const noop = () => {};

test("header: repository link, change name, close control and warnings — no status labels", () => {
  const header = DetailHeader({ repo, change, onClose: noop });
  expect(textOf(classed(header, "change-name")[0])).toBe("multi-tenant-sync");
  const links = byTag(header, "a");
  expect(links.map((a) => [textOf(a).trim(), a.props.href])).toEqual([["forum-admin", "/repo/r1"]]);
  expect(classed(header, "detail-close").map((b) => b.props["aria-label"])).toEqual(["Close"]);
  const text = textOf(header);
  expect(text).toContain("could not read artifacts: unknown schema 'custom'");
  for (const label of ["Implementing", "4/12", "3d ago", "created", "2026-03-02", "spec-driven", "feat/multi-tenant-sync"]) expect(text).not.toContain(label);
  expect(classed(header, "meter")).toEqual([]);
  expect(elements(header).some((el) => String(el.props["aria-label"] ?? "").startsWith("branch"))).toBe(false);
  // no copy actions in the header any more
  expect(byComponent(header, CopyButton)).toEqual([]);

  const archived = DetailHeader({ repo, change: { ...change, archived: "2026-03-09", column: "Archived", tasks: null, warnings: undefined }, onClose: noop });
  expect(textOf(archived)).not.toContain("2026-03-09");
  expect(classed(archived, "notice")).toEqual([]);
});

test("the repository link keeps the filters of that repository's board when the view came from it", () => {
  const repoHref = (from?: string) => byTag(DetailHeader({ repo, change, from, onClose: noop }), "a")[0].props.href;
  expect(repoHref("/repo/r1?q=sync")).toBe("/repo/r1?q=sync");
  expect(repoHref("/board?q=sync")).toBe("/repo/r1");
  expect(repoHref("https://example.com/")).toBe("/repo/r1");
  expect(repoHref(undefined)).toBe("/repo/r1");
});

test("the overlay is a modal dialog named after the change, on a backdrop", () => {
  const view = DetailOverlay({ label: "Change multi-tenant-sync", onClose: noop, children: DetailHeader({ repo, change, onClose: noop }) });
  expect(String(view.props.class)).toContain("detail-overlay");
  const dialogs = elements(view).filter((el) => el.props.role === "dialog");
  expect(dialogs.length).toBe(1);
  expect(dialogs[0].props["aria-modal"]).toBe("true");
  expect(dialogs[0].props["aria-label"]).toContain("multi-tenant-sync");
  expect(dialogs[0].props.tabIndex).toBe(-1); // focusable, so the focus can move into it on open
});

test("close control, backdrop and Escape all lead to the same board", () => {
  for (const [from, expected] of [
    ["/board?q=sync", { path: "/board", query: "?q=sync" }],
    ["/repo/r1?stale=5", { path: "/repo/r1", query: "?stale=5" }],
    ["https://example.com/", { path: "/repo/r1", query: "" }],
    [undefined, { path: "/repo/r1", query: "" }],
  ] as const) {
    const went: { path: string; query: string }[] = [];
    const close = detailClose(from, "r1", (path, query) => went.push({ path, query }));
    const overlay = DetailOverlay({ label: "x", onClose: close, children: DetailHeader({ repo, change, from, onClose: close }) });

    // the close control
    (classed(overlay, "detail-close")[0].props.onClick as () => void)();
    // the backdrop: a press and a click on the backdrop itself
    const backdrop = {};
    (overlay.props.onMouseDown as (e: unknown) => void)({ target: backdrop, currentTarget: backdrop });
    (overlay.props.onClick as (e: unknown) => void)({ target: backdrop, currentTarget: backdrop });
    // Escape
    closeOnEscape(close)({ key: "Escape", defaultPrevented: false, preventDefault: noop } as unknown as KeyboardEvent);

    expect(went).toEqual([expected, expected, expected]);
    expect(backTarget(from, "r1")).toEqual(expected);
  }
});

test("only a press and click on the backdrop itself close, and only Escape among keys", () => {
  let closed = 0;
  const overlay = DetailOverlay({ label: "x", onClose: () => closed++, children: null });
  const down = overlay.props.onMouseDown as (e: unknown) => void;
  const click = overlay.props.onClick as (e: unknown) => void;
  const backdrop = {};
  const panel = {};
  // a click inside the panel bubbles up with another target
  down({ target: panel, currentTarget: backdrop });
  click({ target: panel, currentTarget: backdrop });
  // a text selection dragged out of the panel: pressed inside, released on the backdrop
  click({ target: backdrop, currentTarget: backdrop });
  expect(closed).toBe(0);

  const onKey = closeOnEscape(() => closed++);
  onKey({ key: "Enter", defaultPrevented: false, preventDefault: noop } as unknown as KeyboardEvent);
  onKey({ key: "Escape", defaultPrevented: true, preventDefault: noop } as unknown as KeyboardEvent); // someone else handled it
  expect(closed).toBe(0);
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
  expect(absoluteFilePath(`${DIR}/`, "specs/a/spec.md")).toBe(`${DIR}/specs/a/spec.md`);
  const big = FileContent({ state: tooLarge, raw: false, isTasks: false, rendered: null, filePath: absoluteFilePath(DIR, "huge.md") });
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

test("Show details is a card's only link, carrying the board and its filters", () => {
  const link = cardLink(card, "/board?q=sync&archived=0");
  expect(link.path).toBe("/repo/r1/change/multi-tenant-sync");
  expect(routeFromPath(link.path)).toEqual({ view: "change", repoId: "r1", changeName: "multi-tenant-sync" });
  expect(backTarget(parseDetailQuery(link.query).from, "r1")).toEqual({ path: "/board", query: "?q=sync&archived=0" });

  for (const showRepo of [true, false]) {
    const view = ChangeCard({ card, now: NOW, showRepo, from: "/board?q=sync" });
    const anchors = byTag(view, "a");
    expect(anchors.map((a) => a.props.href)).toEqual(["/repo/r1/change/multi-tenant-sync?from=%2Fboard%3Fq%3Dsync"]);
    expect(textOf(anchors[0]).trim()).toBe("Show details");
    expect(anchors[0].props["aria-label"]).toBe("Show details of multi-tenant-sync");
    // the change name is plain text, and the card has no copy action any more
    expect(textOf(classed(view, "name")[0])).toBe("multi-tenant-sync");
    expect(byComponent(view, CopyButton)).toEqual([]);
  }
  const archived = ChangeCard({ card: { ...card, archived: "2026-03-09" }, now: NOW, showRepo: true, from: "/board" });
  expect(byTag(archived, "a").map((a) => textOf(a).trim())).toEqual(["Show details"]);
});

test("the card's content is unchanged, and a prompt still shows its badge", () => {
  const view = ChangeCard({ card, now: NOW, showRepo: true, from: "/board" });
  expect(elements(byTag(view, "a")[0].props.children)).toEqual([]); // no button or session starter inside the link
  const text = textOf(view);
  for (const part of ["forum-admin", "multi-tenant-sync", "4/12", "3d ago"]) expect(text).toContain(part);

  const drafting: Card = { ...card, column: "Proposal", stage: "artifact", prompt: "Log every mutation" };
  expect(textOf(ChangeCard({ card: drafting, now: NOW, showRepo: true, from: "/board" }))).toContain("prompt");
  expect(textOf(ChangeCard({ card: { ...drafting, prompt: undefined }, now: NOW, showRepo: true, from: "/board" }))).not.toContain("prompt");
});

test("a board behind the detail view takes its filters from the query it is given", () => {
  expect(initialFilters("?q=sync", undefined).q).toBe("sync");
  // a repository board drops a stray repo filter
  expect(initialFilters("?q=sync&repos=r2", "r1")).toMatchObject({ q: "sync", repos: [] });
  // the detail view's own query carries no filter
  expect(initialFilters("?artifact=specs&from=%2Fboard%3Fq%3Dsync", undefined).q).toBe("");
});

import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { PROMPT_LIMIT_BYTES, Scanner, scanRepo } from "../src/server/scanner.ts";
import { LocalRepoSource } from "../src/server/source.ts";
import { FIXTURES, tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterAll(() => cleanup());

const nano = newRepoConfig(join(FIXTURES, "demo-ops"), true);
const soc = newRepoConfig(join(FIXTURES, "beta-soc"), true);

test("scans a fixture repo: artifacts, tasks, archive dates, columns", async () => {
  const snap = await scanRepo(nano);
  expect(snap.ok).toBe(true);
  const byName = new Map(snap.changes.map((c) => [c.name, c]));

  const aws = byName.get("cloud-deployment")!;
  expect(aws.artifacts.map((a) => a.id)).toEqual(["proposal", "specs", "design", "tasks"]);
  expect(aws.artifacts.every((a) => a.status === "done")).toBe(true);
  expect(aws.tasks?.total).toBeGreaterThan(0);
  expect(aws.lastActivityAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  const { done, total } = aws.tasks!;
  expect(aws.column).toBe(done === total ? "Done" : done > 0 ? "Implementing" : "Ready");

  const complete = byName.get("configurable-builder")!;
  expect(complete.tasks?.done).toBe(complete.tasks?.total);
  expect(complete.column).toBe("Done");

  const archived = byName.get("runbook-repo-field")!;
  expect(archived.archived).toBe("2026-06-18");
  expect(archived.created).toBe("2026-06-16");
  expect(archived.column).toBe("Archived");
  expect(archived.tasks?.done).toBe(archived.tasks?.total);
});

test("all artifacts done with an empty tasks file lands in Ready with a warning", async () => {
  const root = await tempDir();
  const change = join(root, "openspec", "changes", "empty-tasks");
  await mkdir(join(change, "specs", "cap"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(change, ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-01\n");
  for (const f of ["proposal.md", "design.md"]) await writeFile(join(change, f), "# x\n");
  await writeFile(join(change, "specs", "cap", "spec.md"), "## ADDED Requirements\n");
  await writeFile(join(change, "tasks.md"), "## 1. Nothing\n\n(no tasks yet)\n");

  const snap = await scanRepo(newRepoConfig(root, true));
  const empty = snap.changes.find((c) => c.name === "empty-tasks")!;
  expect(empty.artifacts.every((a) => a.status === "done")).toBe(true);
  expect(empty.tasks).toEqual({ done: 0, total: 0 });
  expect(empty.column).toBe("Ready");
  expect(empty.warnings).toContain("tasks file has no tasks");
  expect(empty.created).toBe("2026-09-01");
  await rm(root, { recursive: true, force: true });
});

test("skip_specs marks spec artifacts done; unknown schema is reported per change", async () => {
  const root = await tempDir();
  await mkdir(join(root, "openspec", "changes", "refactor"), { recursive: true });
  await mkdir(join(root, "openspec", "changes", "odd"), { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
  await writeFile(join(root, "openspec", "changes", "refactor", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-02\nskip_specs: true\n");
  await writeFile(join(root, "openspec", "changes", "refactor", "proposal.md"), "# p\n");
  await writeFile(join(root, "openspec", "changes", "odd", ".openspec.yaml"), "schema: my-custom\ncreated: 2026-09-03\n");

  const snap = await scanRepo(newRepoConfig(root, true));
  const refactor = snap.changes.find((c) => c.name === "refactor")!;
  expect(refactor.artifacts).toEqual([
    { id: "proposal", status: "done" },
    { id: "specs", status: "done" },
    { id: "design", status: "ready" },
    { id: "tasks", status: "blocked" },
  ]);
  // design comes before specs in display order and is not written, so the last completed step is the proposal
  expect(refactor.column).toBe("Proposal");

  const odd = snap.changes.find((c) => c.name === "odd")!;
  expect(odd.schema).toBe("my-custom");
  expect(odd.artifacts).toEqual([]);
  expect(odd.column).toBe("Unknown");
  expect(odd.warnings?.[0]).toMatch(/unknown schema 'my-custom'/);
  await rm(root, { recursive: true, force: true });
});

test("archived list is sorted newest first and archive count matches disk", async () => {
  const snap = await scanRepo(soc);
  const archived = snap.changes.filter((c) => c.archived);
  expect(archived.length).toBe(16);
  const dates = archived.map((c) => c.archived!);
  expect([...dates].sort().reverse()).toEqual(dates);
});

test("missing repo path yields ok:false without throwing", async () => {
  const snap = await scanRepo(newRepoConfig("/nonexistent/repo", true));
  expect(snap.ok).toBe(false);
  expect(snap.error).toMatch(/does not exist/);
});

test("unexpected change directory names are skipped with a warning", async () => {
  class Weird extends LocalRepoSource {
    override async listChanges() {
      const listing = await super.listChanges();
      return { ...listing, warnings: [...listing.warnings, 'skipped change directory with unexpected name: "foo;rm -rf"'] };
    }
  }
  const snap = await scanRepo(nano, new Weird(nano.path));
  expect(snap.warnings?.[0]).toContain("foo;rm -rf");
});

test("scanner isolates a failing repo and keeps its last good changes", async () => {
  const config = { ...defaultConfig(), repos: [nano, soc] };
  const scanner = new Scanner(() => config, { persist: false });
  await scanner.trigger().done;
  expect(scanner.snapshot.repos.map((r) => r.ok)).toEqual([true, true]);
  const socChanges = scanner.snapshot.repos[1].changes.length;

  const failing = new Scanner(() => config, {
    persist: false,
    sourceFor: (repo) => {
      const src = new LocalRepoSource(repo.path);
      if (repo.id === soc.id) src.listChanges = () => Promise.reject(new Error("disk on fire"));
      return src;
    },
  }, scanner.snapshot);
  const { started, done } = failing.trigger();
  expect(started).toBe(true);
  expect(failing.trigger().started).toBe(false);
  await done;
  const [n, b] = failing.snapshot.repos;
  expect(n.ok).toBe(true);
  expect(b.ok).toBe(false);
  expect(b.error).toBe("disk on fire");
  expect(b.changes.length).toBe(socChanges);
});

test("scanner reports prompt.md: absent, small, oversized, and does not affect artifact status", async () => {
  const root = await tempDir();
  const changeRoot = join(root, "openspec", "changes");
  await mkdir(changeRoot, { recursive: true });
  await writeFile(join(root, "openspec", "config.yaml"), "schema: spec-driven\n");

  await mkdir(join(changeRoot, "no-prompt"), { recursive: true });
  await writeFile(join(changeRoot, "no-prompt", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-01\n");

  await mkdir(join(changeRoot, "with-prompt"), { recursive: true });
  await writeFile(join(changeRoot, "with-prompt", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-02\n");
  await writeFile(join(changeRoot, "with-prompt", "prompt.md"), "# Prompt\n\nLog every mutation\n");

  await mkdir(join(changeRoot, "oversized"), { recursive: true });
  await writeFile(join(changeRoot, "oversized", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-09-03\n");
  await writeFile(join(changeRoot, "oversized", "prompt.md"), "a".repeat(PROMPT_LIMIT_BYTES + 100));

  const snap = await scanRepo(newRepoConfig(root, true));
  const byName = new Map(snap.changes.map((c) => [c.name, c]));

  const noPrompt = byName.get("no-prompt")!;
  expect(noPrompt.prompt).toBeUndefined();
  // Artifact status unchanged by the prompt logic — proposal not done ⇒ "New".
  expect(noPrompt.column).toBe("New");

  const withPrompt = byName.get("with-prompt")!;
  expect(withPrompt.prompt).toBe("# Prompt\n\nLog every mutation\n");
  expect(withPrompt.column).toBe("New");

  const oversized = byName.get("oversized")!;
  expect(oversized.prompt?.length).toBe(PROMPT_LIMIT_BYTES);
  expect(oversized.warnings?.some((w) => w.includes("larger than"))).toBe(true);

  await rm(root, { recursive: true, force: true });
});

import { afterEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { Scanner } from "../src/server/scanner.ts";
import { tempDir, treeFingerprint, useTempHome } from "./helpers.ts";

interface Harness {
  base: string;
  state: AppState;
  server: ReturnType<typeof Bun.serve>;
  home: () => Promise<void>;
  repoRoot: string;
  repoId: string;
}

async function harness(options: { withOpenspecDir?: boolean; withArchive?: boolean; enabled?: boolean; schema?: string } = {}): Promise<Harness> {
  const { withOpenspecDir = true, withArchive = false, enabled = true, schema = "spec-driven" } = options;
  const { cleanup } = await useTempHome();
  const repoRoot = await tempDir("osd-repo-");
  if (withOpenspecDir) {
    await mkdir(join(repoRoot, "openspec", "changes"), { recursive: true });
    await writeFile(join(repoRoot, "openspec", "config.yaml"), `schema: ${schema}\n`);
  }
  if (withArchive) {
    await mkdir(join(repoRoot, "openspec", "changes", "archive", "2026-06-18-old-thing"), { recursive: true });
    await writeFile(join(repoRoot, "openspec", "changes", "archive", "2026-06-18-old-thing", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-06-18\n");
  }
  const repo = newRepoConfig(repoRoot, enabled);
  const state: AppState = { config: { ...defaultConfig(), repos: [repo] }, scanner: undefined as unknown as Scanner };
  state.scanner = new Scanner(() => state.config, { persist: false });
  await state.scanner.trigger().done;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "" }) });
  const base = `http://127.0.0.1:${server.port}`;
  return {
    base, state, server, repoRoot, repoId: repo.id,
    home: async () => {
      state.scanner.stop();
      server.stop(true);
      await rm(repoRoot, { recursive: true, force: true });
      await cleanup();
    },
  };
}

const post = (base: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

let h: Harness;
afterEach(() => h?.home());

test("POST /api/repos/:id/changes creates the directory and returns 201", async () => {
  h = await harness();
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail" });
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ name: "add-audit-trail" });
  const marker = await Bun.file(join(h.repoRoot, "openspec", "changes", "add-audit-trail", ".openspec.yaml")).text();
  expect(marker).toContain("schema: spec-driven");
});

test("a successful create writes only the new change directory (nothing else moves)", async () => {
  h = await harness();
  // Seed a pre-existing sibling change and a config file to make the tree richer.
  await mkdir(join(h.repoRoot, "openspec", "changes", "prior"), { recursive: true });
  await writeFile(join(h.repoRoot, "openspec", "changes", "prior", ".openspec.yaml"), "schema: spec-driven\ncreated: 2026-08-01\n");
  await writeFile(join(h.repoRoot, "openspec", "changes", "prior", "proposal.md"), "# Prior\n");
  const beforeFiles = await treeFingerprint(h.repoRoot);

  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail", prompt: "Log every mutation" });
  expect(res.status).toBe(201);

  // The prior change and every other path is unchanged: fingerprint the tree excluding the new directory.
  const priorAfter = await treeFingerprint(join(h.repoRoot, "openspec", "changes", "prior"));
  const priorBefore = await treeFingerprint(join(h.repoRoot, "openspec", "changes", "prior"));
  expect(priorAfter).toBe(priorBefore);
  // The only new files are inside the new change directory.
  const newDir = join(h.repoRoot, "openspec", "changes", "add-audit-trail");
  expect(await Bun.file(join(newDir, ".openspec.yaml")).exists()).toBe(true);
  expect(await Bun.file(join(newDir, "prompt.md")).exists()).toBe(true);
  // Sanity: nothing that would indicate the endpoint wrote outside the tree.
  expect(beforeFiles.split("\n").every((line) => line.length > 0)).toBe(true);
});

test("subsequent GET /api/state reflects the new change (prompt included, recognised marker)", async () => {
  h = await harness();
  const create = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail", prompt: "Log every mutation" });
  expect(create.status).toBe(201);
  await h.state.scanner.trigger().done; // ensure the rescan we triggered ran

  const dir = join(h.repoRoot, "openspec", "changes", "add-audit-trail");
  const marker = await Bun.file(join(dir, ".openspec.yaml")).text();
  expect(marker).toMatch(/^schema: spec-driven\ncreated: \d{4}-\d{2}-\d{2}\n$/);
  const promptFile = await Bun.file(join(dir, "prompt.md")).text();
  expect(promptFile).toBe("# Prompt\n\nLog every mutation\n");

  const snap = await (await fetch(`${h.base}/api/state`)).json();
  const change = snap.repos[0].changes.find((c: { name: string }) => c.name === "add-audit-trail");
  expect(change).toBeTruthy();
  // The scanner ran through the OpenSpec adapter and recognised the marker as `spec-driven`:
  expect(change.schema).toBe("spec-driven");
  // No artifact is done, so it sits in New with the prompt visible on the snapshot.
  expect(change.column).toBe("New");
  expect(change.prompt).toBe("# Prompt\n\nLog every mutation\n");
});

test("400 on invalid name", async () => {
  h = await harness();
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "foo/bar" });
  expect(res.status).toBe(400);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("404 for an unknown repository", async () => {
  h = await harness();
  const res = await post(h.base, `/api/repos/does-not-exist/changes`, { name: "add-audit-trail" });
  expect(res.status).toBe(404);
});

test("409 when the repository is disabled", async () => {
  h = await harness({ enabled: false });
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail" });
  expect(res.status).toBe(409);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("409 when there is no openspec/ directory", async () => {
  h = await harness({ withOpenspecDir: false });
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail" });
  expect(res.status).toBe(409);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("409 for a duplicate active name", async () => {
  h = await harness();
  await mkdir(join(h.repoRoot, "openspec", "changes", "add-audit-trail"), { recursive: true });
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail" });
  expect(res.status).toBe(409);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("409 for a duplicate archived name", async () => {
  h = await harness({ withArchive: true });
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "old-thing" });
  expect(res.status).toBe(409);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("403 for a foreign origin and no directory is written", async () => {
  h = await harness();
  const before = await treeFingerprint(h.repoRoot);
  const res = await post(h.base, `/api/repos/${h.repoId}/changes`, { name: "add-audit-trail" }, { origin: "https://example.com" });
  expect(res.status).toBe(403);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("403 for a non-JSON content type and no directory is written", async () => {
  h = await harness();
  const before = await treeFingerprint(h.repoRoot);
  const res = await fetch(`${h.base}/api/repos/${h.repoId}/changes`, { method: "POST", body: JSON.stringify({ name: "add-audit-trail" }), headers: { "content-type": "text/plain" } });
  expect(res.status).toBe(403);
  expect(await treeFingerprint(h.repoRoot)).toBe(before);
});

test("400 for a malformed JSON body", async () => {
  h = await harness();
  const res = await fetch(`${h.base}/api/repos/${h.repoId}/changes`, { method: "POST", body: "{not json", headers: { "content-type": "application/json" } });
  expect(res.status).toBe(400);
});

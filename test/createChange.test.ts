import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createChange } from "../src/server/createChange.ts";
import { tempDir } from "./helpers.ts";

async function repoWithOpenspec(schema?: string): Promise<string> {
  const root = await tempDir();
  await mkdir(join(root, "openspec", "changes"), { recursive: true });
  if (schema !== undefined) await writeFile(join(root, "openspec", "config.yaml"), `schema: ${schema}\n`);
  return root;
}

test("creates a change directory with .openspec.yaml only when no prompt", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(false);
  const marker = await readFile(join(root, "openspec", "changes", "add-audit-trail", ".openspec.yaml"), "utf8");
  expect(marker).toMatch(/^schema: spec-driven\ncreated: \d{4}-\d{2}-\d{2}\n$/);
  await expect(readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8")).rejects.toThrow();
});

test("writes prompt.md when a non-empty prompt is given", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", "Log every mutation to the audit table");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(true);
  const prompt = await readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8");
  expect(prompt).toBe("# Prompt\n\nLog every mutation to the audit table\n");
});

test("skips prompt.md when the prompt is only whitespace", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", "   \n\t\n  ");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.wrotePrompt).toBe(false);
  await expect(readFile(join(root, "openspec", "changes", "add-audit-trail", "prompt.md"), "utf8")).rejects.toThrow();
});

test("reads schema from openspec/config.yaml and falls back to spec-driven", async () => {
  const withSchema = await repoWithOpenspec("alpha");
  const withResult = await createChange(withSchema, "one");
  expect(withResult.ok).toBe(true);
  const withMarker = await readFile(join(withSchema, "openspec", "changes", "one", ".openspec.yaml"), "utf8");
  expect(withMarker).toContain("schema: alpha");

  const withoutSchema = await repoWithOpenspec();
  const withoutResult = await createChange(withoutSchema, "two");
  expect(withoutResult.ok).toBe(true);
  const withoutMarker = await readFile(join(withoutSchema, "openspec", "changes", "two", ".openspec.yaml"), "utf8");
  expect(withoutMarker).toContain("schema: spec-driven");
});

test("rejects an invalid change name", async () => {
  const root = await repoWithOpenspec();
  for (const name of ["", "foo/bar", "with space", "with;semicolon", "with$dollar"]) {
    const result = await createChange(root, name);
    expect([name, result.ok]).toEqual([name, false]);
    if (result.ok) continue;
    expect([name, result.reason]).toEqual([name, "invalid-name"]);
  }
});

test("rejects a non-string prompt", async () => {
  const root = await repoWithOpenspec();
  const result = await createChange(root, "add-audit-trail", 123 as unknown as string);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("invalid-prompt");
});

test("rejects when openspec/changes/ is missing", async () => {
  const root = await tempDir();
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("no-openspec-dir");
});

test("rejects a duplicate active name", async () => {
  const root = await repoWithOpenspec();
  await mkdir(join(root, "openspec", "changes", "add-audit-trail"), { recursive: true });
  const result = await createChange(root, "add-audit-trail");
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("duplicate-active");
});

test("rejects a duplicate archived name (with and without date prefix)", async () => {
  const root = await repoWithOpenspec();
  await mkdir(join(root, "openspec", "changes", "archive", "2026-06-18-old-thing"), { recursive: true });
  const dated = await createChange(root, "old-thing");
  expect(dated.ok).toBe(false);
  if (!dated.ok) expect(dated.reason).toBe("duplicate-archived");

  await mkdir(join(root, "openspec", "changes", "archive", "no-prefix"), { recursive: true });
  const undated = await createChange(root, "no-prefix");
  expect(undated.ok).toBe(false);
  if (!undated.ok) expect(undated.reason).toBe("duplicate-archived");
});

test("concurrent createChange for the same name: exactly one wins", async () => {
  const root = await repoWithOpenspec();
  const results = await Promise.all(Array.from({ length: 10 }, () => createChange(root, "race")));
  const wins = results.filter((r) => r.ok);
  const losses = results.filter((r) => !r.ok);
  expect(wins.length).toBe(1);
  expect(losses.length).toBe(9);
  for (const l of losses) if (!l.ok) expect(l.reason).toBe("duplicate-active");
  const entries = readdirSync(join(root, "openspec", "changes", "race"));
  expect(entries.sort()).toEqual([".openspec.yaml"]);
});

test("createChange spawns no subprocess (static check)", () => {
  const src = readFileSync(join(import.meta.dir, "..", "src", "server", "createChange.ts"), "utf8");
  for (const forbidden of ["Bun.spawn", "child_process", "node:child_process", "execSync", "execFile", "execFileSync"]) {
    expect([forbidden, src.includes(forbidden)]).toEqual([forbidden, false]);
  }
});

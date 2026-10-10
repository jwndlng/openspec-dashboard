import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, newRepoConfig } from "../src/server/config.ts";
import { checkNewFolder, makeNewFolder, NewFolderError } from "../src/server/newFolder.ts";
import { canonicalPath, dashboardHome } from "../src/server/paths.ts";
import type { Config } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let restoreHome: () => Promise<void>;
beforeAll(async () => {
  restoreHome = (await useTempHome()).cleanup;
});
afterAll(async () => {
  await restoreHome();
});

async function refusal(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(err instanceof NewFolderError)) throw new Error(`expected a NewFolderError, got ${String(err)}`);
  return { status: err.status, message: err.message };
}

const configFor = (patch: Partial<Config>): Config => ({ ...defaultConfig(), ...patch });

test("a free name directly inside a configured root is accepted and created exclusively", async () => {
  const root = canonicalPath(await tempDir("osd-newfolder-"));
  const { path } = await checkNewFolder(configFor({ scanRoots: [root] }), root, "gamma-tools");
  expect(path).toBe(join(root, "gamma-tools"));
  await makeNewFolder(path);
  expect(await readdir(path)).toEqual([]);
  expect((await refusal(makeNewFolder(path))).status).toBe(409);
});

test("refusals: name, root, anything at the path, tracked repository, ignore path, home", async () => {
  const root = canonicalPath(await tempDir("osd-newfolder-"));
  const config = configFor({ scanRoots: [root] });
  for (const name of ["", "../x", "a/b", ".hidden", "x.git", 42]) expect((await refusal(checkNewFolder(config, root, name))).status).toBe(400);
  expect((await refusal(checkNewFolder(config, "/w/other", "x"))).status).toBe(404);
  const gone = join(root, "gone");
  expect((await refusal(checkNewFolder(configFor({ scanRoots: [gone] }), gone, "x"))).status).toBe(404);

  await writeFile(join(root, "a-file"), "x");
  await symlink(join(root, "nowhere"), join(root, "dangling"));
  for (const name of ["a-file", "dangling"]) expect(await refusal(checkNewFolder(config, root, name))).toEqual({ status: 409, message: `${join(root, name)} already exists` });

  // A tracked repository that is itself the root: everything directly inside it lies in it.
  const tracked = configFor({ scanRoots: [root], repos: [{ ...newRepoConfig(root, true), name: "demo-ops" }] });
  expect((await refusal(checkNewFolder(tracked, root, "nested"))).message).toContain("tracked repository demo-ops");
  const ignoring = configFor({ scanRoots: [root], ignorePaths: [join(root, "mirror")] });
  expect((await refusal(checkNewFolder(ignoring, root, "mirror"))).message).toContain("ignore path");
  await mkdir(dashboardHome(), { recursive: true });
  const home = canonicalPath(dashboardHome());
  const inHome = configFor({ scanRoots: [home] });
  expect((await refusal(checkNewFolder(inHome, home, "x"))).message).toContain("dashboard's own folder");
  expect(existsSync(join(root, "nested"))).toBe(false);
});

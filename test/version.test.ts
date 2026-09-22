// The version the binary reports: `dev` outside a release build, and `--version` answers without touching anything.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { VERSION } from "../src/server/version.ts";
import { tempDir } from "./helpers.ts";

const root = join(import.meta.dir, "..");
let home: string;

beforeAll(async () => {
  home = await tempDir("osd-home-");
  // The CLI entry imports the built UI.
  if (!existsSync(join(root, "dist", "ui", "index.html"))) {
    const build = Bun.spawn(["bun", "run", join(root, "scripts", "build-ui.ts")], { cwd: root, stdout: "ignore", stderr: "inherit" });
    expect(await build.exited).toBe(0);
  }
});
afterAll(async () => {
  await rm(home, { recursive: true, force: true });
});

async function cli(...args: string[]): Promise<{ code: number; stdout: string }> {
  const proc = Bun.spawn(["bun", "run", join(root, "src", "server", "index.ts"), ...args], {
    cwd: root,
    env: { ...process.env, OPENSPEC_DASHBOARD_HOME: home },
    stdout: "pipe",
    stderr: "inherit",
  });
  const stdout = await new Response(proc.stdout).text();
  return { code: await proc.exited, stdout };
}

test("without a build-time define the version is dev", () => {
  expect(VERSION).toBe("dev");
});

test("--version prints the version, exits 0 and writes nothing", async () => {
  expect(await cli("--version")).toEqual({ code: 0, stdout: "dev\n" });
  expect(await readdir(home)).toEqual([]);
});

test("--help lists --version", async () => {
  const { code, stdout } = await cli("--help");
  expect(code).toBe(0);
  expect(stdout).toContain("--version");
});

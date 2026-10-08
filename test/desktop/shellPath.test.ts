import { afterAll, expect, test } from "bun:test";
import { chmod, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fallbackPath, loginShellPath, parseShellPath, shellPathCommand } from "../../desktop/src/logic/shellPath.ts";
import { tempDir } from "../helpers.ts";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

/** A stand-in for the user's shell: prints a banner, then whatever its script says. */
async function fakeShell(script: string): Promise<string> {
  const d = await tempDir("sc-shell-");
  dirs.push(d);
  const path = join(d, "fake-shell");
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

test("the path between the sentinels survives a banner-printing profile", () => {
  expect(parseShellPath("Welcome back!\nLast login: today\n__SC_PATH__/opt/homebrew/bin:/usr/bin__SC_PATH__")).toBe("/opt/homebrew/bin:/usr/bin");
  expect(parseShellPath("banner __SC_PATH__/a:/b__SC_PATH__ trailing")).toBe("/a:/b");
});

test("empty output, a missing sentinel or an empty PATH give nothing", () => {
  expect(parseShellPath("")).toBeUndefined();
  expect(parseShellPath("/usr/bin:/bin")).toBeUndefined();
  expect(parseShellPath("__SC_PATH__/usr/bin:/bin")).toBeUndefined();
  expect(parseShellPath("__SC_PATH____SC_PATH__")).toBeUndefined();
});

test("the command is a non-interactive login shell, zsh when SHELL is unset", () => {
  expect(shellPathCommand(undefined).slice(0, 3)).toEqual(["/bin/zsh", "-l", "-c"]);
  expect(shellPathCommand("/bin/bash")[0]).toBe("/bin/bash");
  expect(shellPathCommand("")[0]).toBe("/bin/zsh");
});

test("the fallback has both Homebrew prefixes and the standard directories", () => {
  expect(fallbackPath().split(":")).toEqual(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
});

test("a real shell run: the answer, a failing shell, a missing shell and one that hangs", async () => {
  const answering = await fakeShell(`echo "Hello from .zprofile"; printf '%s' "__SC_PATH__/w/tools/bin:/usr/bin__SC_PATH__"`);
  expect(await loginShellPath(answering)).toEqual({ path: "/w/tools/bin:/usr/bin", fromShell: true });
  const failing = await fakeShell("exit 3");
  expect(await loginShellPath(failing)).toEqual({ path: fallbackPath(), fromShell: false });
  expect(await loginShellPath("/w/no/such/shell")).toEqual({ path: fallbackPath(), fromShell: false });
  const hanging = await fakeShell("sleep 30");
  const started = Date.now();
  expect(await loginShellPath(hanging, 200)).toEqual({ path: fallbackPath(), fromShell: false });
  expect(Date.now() - started).toBeLessThan(5000);
});

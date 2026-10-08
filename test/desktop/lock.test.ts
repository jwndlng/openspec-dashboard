import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { acquireLock, lockPath, pidAlive } from "../../desktop/src/logic/lock.ts";
import { useTempHome } from "../helpers.ts";

let home: string;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ home, cleanup } = await useTempHome());
});
afterAll(() => cleanup());

/** A PID that is certainly not running: a child that has already exited. */
async function deadPid(): Promise<number> {
  const child = Bun.spawn(["true"]);
  await child.exited;
  return child.pid;
}

test("a missing lock is taken and released", async () => {
  const lock = await acquireLock(home);
  expect(lock.kind).toBe("acquired");
  expect((await readFile(lockPath(home), "utf8")).trim()).toBe(String(process.pid));
  if (lock.kind === "acquired") await lock.release();
  expect(await Bun.file(lockPath(home)).exists()).toBe(false);
});

test("a live lock is held by its app", async () => {
  const other = Bun.spawn(["sleep", "30"]);
  try {
    expect(pidAlive(other.pid)).toBe(true);
    await writeFile(lockPath(home), `${other.pid}\n`);
    expect(await acquireLock(home)).toEqual({ kind: "held", pid: other.pid });
    expect((await readFile(lockPath(home), "utf8")).trim()).toBe(String(other.pid));
  } finally {
    other.kill();
    await other.exited;
  }
});

test("a stale lock is taken over", async () => {
  const pid = await deadPid();
  expect(pidAlive(pid)).toBe(false);
  await writeFile(lockPath(home), `${pid}\n`);
  const lock = await acquireLock(home);
  expect(lock.kind).toBe("acquired");
  expect((await readFile(lockPath(home), "utf8")).trim()).toBe(String(process.pid));
  if (lock.kind === "acquired") await lock.release();
});

test("an unreadable lock is stale too, and releasing leaves another app's lock alone", async () => {
  await writeFile(lockPath(home), "garbage");
  const lock = await acquireLock(home);
  expect(lock.kind).toBe("acquired");
  const other = Bun.spawn(["sleep", "30"]);
  try {
    await writeFile(lockPath(home), `${other.pid}\n`); // someone else took over
    if (lock.kind === "acquired") await lock.release();
    expect((await readFile(lockPath(home), "utf8")).trim()).toBe(String(other.pid));
  } finally {
    other.kill();
    await other.exited;
  }
});

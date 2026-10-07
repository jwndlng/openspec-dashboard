// Puts a fake `gh` first on PATH, so the pull-request tests exercise the real spawning code without the real GitHub
// CLI and without a network. Nothing here starts a process itself; `fake-gh.ts` does the answering.
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FIXTURES, tempDir } from "./helpers.ts";

export const FAKE_GH = join(FIXTURES, "fake-gh.ts");

export interface GhCall {
  argv: string[];
  cwd: string;
}

export interface GhHarness {
  /** Directory holding the `gh` shim; first on PATH while the harness is installed. */
  bin: string;
  /** Replaces the scenario the fake answers from. */
  scenario(value: unknown): Promise<void>;
  /** Every invocation so far, in order. */
  calls(): Promise<GhCall[]>;
  forget(): Promise<void>;
  /** Restores PATH and the scenario/log environment. */
  restore(): void;
}

const saved = (name: string) => {
  const before = process.env[name];
  return () => {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  };
};

/**
 * Writes an executable `gh` that runs the fake, puts its directory first on PATH and points the fake at a fresh
 * scenario and call log. `install({ onPath: false })` writes everything but leaves PATH alone, for the
 * "GitHub CLI not installed" case.
 */
export async function installFakeGh(scenario: unknown = {}, options: { onPath?: boolean } = {}): Promise<GhHarness> {
  const base = await tempDir("osd-gh-");
  const bin = join(base, "bin");
  await mkdir(bin, { recursive: true });
  const shim = join(bin, "gh");
  await writeFile(shim, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(FAKE_GH)} "$@"\n`);
  await chmod(shim, 0o755);

  const scenarioPath = join(base, "scenario.json");
  const logPath = join(base, "calls.jsonl");
  const restorers = [saved("PATH"), saved("FAKE_GH_SCENARIO"), saved("FAKE_GH_LOG")];
  await writeFile(scenarioPath, JSON.stringify(scenario));
  await writeFile(logPath, "");
  process.env.FAKE_GH_SCENARIO = scenarioPath;
  process.env.FAKE_GH_LOG = logPath;
  if (options.onPath !== false) process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;

  return {
    bin,
    scenario: (value) => writeFile(scenarioPath, JSON.stringify(value)),
    calls: async () =>
      (await readFile(logPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as GhCall),
    forget: () => writeFile(logPath, ""),
    restore: () => {
      for (const restore of restorers) restore();
    },
  };
}

/** A pull request in the shape `gh pr list --json …` prints, with sensible defaults for everything a test does not set. */
export function ghPr(patch: Record<string, unknown> & { number: number }): Record<string, unknown> {
  return {
    title: `change ${patch.number}`,
    url: `https://github.com/acme/alpha-infra/pull/${patch.number}`,
    author: { login: "octo" },
    headRefName: `feat/change-${patch.number}`,
    baseRefName: "main",
    isDraft: false,
    state: "OPEN",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    mergedAt: null,
    closedAt: null,
    reviewDecision: "",
    reviewRequests: [],
    statusCheckRollup: [],
    mergeable: "MERGEABLE",
    ...patch,
  };
}

/** A `CheckRun` entry of `statusCheckRollup`. */
export function checkRun(status: string, conclusion = ""): Record<string, unknown> {
  return { __typename: "CheckRun", name: "ci", status, conclusion };
}

/** A `StatusContext` entry of `statusCheckRollup`. */
export function statusContext(state: string): Record<string, unknown> {
  return { __typename: "StatusContext", context: "legacy", state };
}

/** An open issue in the shape `gh issue list --json …` prints, with defaults for everything a test does not set. */
export function ghIssue(patch: Record<string, unknown> & { number: number }): Record<string, unknown> {
  return {
    title: `issue ${patch.number}`,
    body: `Body of issue ${patch.number}.`,
    url: `https://github.com/acme/alpha-infra/issues/${patch.number}`,
    author: { login: "octo" },
    labels: [],
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-02T10:00:00Z",
    ...patch,
  };
}

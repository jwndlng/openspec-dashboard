// The GitHub CLI, run the one way the dashboard runs it: shared by the pull-request query (pullRequests.ts) and the
// issue query (issues.ts), so both are provably started alike — without a shell, in the dashboard home, with prompts
// disabled, no stdin and a timeout. The subcommands themselves stay in those two modules, written out in full, so the
// read-only `gh pr list`, `gh api user` and `gh issue list` remain the only ones (openspec/specs/dashboard-api).
import { mkdir } from "node:fs/promises";
import type { RepoPullRequests } from "../shared/types.ts";
import { normalizeRemote } from "./git.ts";
import { dashboardHome, whichOnPath } from "./paths.ts";
import { maskCredentials } from "./pull.ts";

export const GH_TIMEOUT_MS = 30_000;

export interface GhFailure {
  /** `unavailable`: cannot be queried at all. `failed`: this attempt did not work. */
  kind: "unavailable" | "failed";
  reason: string;
  /** The machine's `gh`, not this repository: the view says it once rather than per repository. */
  setup?: RepoPullRequests["setup"];
}

// ---- remotes ----

/** `owner/name` for a github.com remote; undefined for every other host, form or failure. */
export function githubRepoFromRemote(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const normalized = normalizeRemote(url);
  if (!normalized?.startsWith("github.com/")) return undefined;
  const parts = normalized.slice("github.com/".length).split("/").filter(Boolean);
  // Exactly owner and name: a longer path is not a repository we can address.
  if (parts.length !== 2) return undefined;
  return `${parts[0]}/${parts[1]}`;
}

// ---- the gh process ----

export interface GhRun {
  ok: boolean;
  out: string;
  err: string;
  timedOut: boolean;
  /** `gh` is not on PATH. */
  missing: boolean;
}

/** `purpose` finishes the sentence "install gh to …": the pull-request and issue views each say what it is for. */
const notInstalled = (purpose: string): GhFailure => ({ kind: "unavailable", reason: `GitHub CLI not installed — install gh to ${purpose}`, setup: "gh-missing" });
const NOT_SIGNED_IN: GhFailure = { kind: "unavailable", reason: "gh is not signed in to github.com — run `gh auth login`", setup: "gh-signed-out" };

/** Whether `gh`'s stderr says the problem is authentication rather than this repository. */
function saysNotSignedIn(stderr: string): boolean {
  return /gh auth login|not logged in|authentication|requires authentication|bad credentials/i.test(stderr);
}

/** The line of `gh`'s stderr worth showing, masked and kept short; never a token, never a whole dump. */
export function ghReason(stderr: string): string {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const first = lines.find((l) => !/^(hint|note):/i.test(l)) ?? "gh gave no reason";
  const text = maskCredentials(first.replace(/^gh:\s*/i, ""));
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

/**
 * `gh` without a shell: no stdin, no prompts, no colour, no update notifier, and a timeout after which the process is
 * killed. The working directory is the dashboard home, so `gh` never looks at — let alone runs git in — a tracked
 * repository. Credentials stay entirely with `gh`; the dashboard never sees them.
 */
export async function runGh(args: string[], timeoutMs = GH_TIMEOUT_MS): Promise<GhRun> {
  // Looked up explicitly rather than left to the spawn: with no `gh` on PATH some platforms fall back to a default
  // search path and would find another one, and the spec wants "not installed" decided before any process starts.
  if (!whichOnPath("gh")) return { ok: false, out: "", err: "gh is not on PATH", timedOut: false, missing: true };
  const cwd = dashboardHome();
  await mkdir(cwd, { recursive: true }).catch(() => undefined);
  const env = { ...process.env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1", GH_SPINNER_DISABLED: "1", NO_COLOR: "1" };
  let timedOut = false;
  try {
    const proc = Bun.spawn(["gh", ...args], { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore", env });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
      return { ok: code === 0 && !timedOut, out, err: err.trim(), timedOut, missing: false };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    return { ok: false, out: "", err: text, timedOut, missing: /ENOENT|not found|No such file/i.test(text) };
  }
}

/** What went wrong, in the terms the UI shows; `undefined` when nothing did. */
export function failureOf(run: GhRun, purpose = "see pull requests"): GhFailure | undefined {
  if (run.missing) return notInstalled(purpose);
  if (run.ok) return undefined;
  if (saysNotSignedIn(run.err)) return NOT_SIGNED_IN;
  if (run.timedOut) return { kind: "failed", reason: "gh timed out" };
  return { kind: "failed", reason: ghReason(run.err) };
}

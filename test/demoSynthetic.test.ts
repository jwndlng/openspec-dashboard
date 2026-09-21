// The demo's sessions and terminal recordings must be as obviously fictional as the rest of the sample. These checks
// exist so that "improving" a transcript by pasting real terminal output fails the build.
import { expect, test } from "bun:test";
import { createDemoApi } from "../src/ui/demo/demoApi.ts";
import { DEMO_AGENT, DEMO_CARRIED, DEMO_PROFILES } from "../src/ui/demo/sampleData.ts";
import { RECORDING_NOTICE, type Step, TRANSCRIPTS } from "../src/ui/demo/transcripts.ts";
import { looksLikeRealHome } from "./helpers.ts";

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** What a transcript or a session record has no business containing. The project's own hosts would be fine; none is needed. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
const URL_LIKE = /\b(?:https?|ssh|git):\/\/|\bwww\./i;
// a dotted name ending in something that reads as a top-level domain — but not a file name like tasks.md or limits.ts
const FILE_EXTENSIONS = /\.(md|ts|tsx|js|json|yaml|yml|css|html|txt|lock|toml|sh)$/i;
const HOST = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|app|ai|co|cloud|internal|local|corp|lan)\b/i;
export function looksReal(text: string): string | undefined {
  if (looksLikeRealHome(text)) return "home directory";
  if (EMAIL.test(text)) return "e-mail address";
  if (URL_LIKE.test(text)) return "URL";
  const host = HOST.exec(text)?.[0];
  if (host && !FILE_EXTENSIONS.test(host)) return "host name";
  return undefined;
}

const transcriptText = (steps: Step[]) => steps.map((s) => ("out" in s ? s.out : "ask" in s ? s.ask : "")).join("");

test("the detector catches what pasted terminal output would bring along, and lets the recordings' own vocabulary through", () => {
  const planted: [string, string][] = [
    ["Author: alice <alice@corp.example>", "e-mail address"],
    ["remote: https://git.corp.example/team/repo", "URL"],
    ["To ssh://buildhost/repo.git", "URL"],
    ["To git@10.0.0.4:team/repo.git", "e-mail address"], // an scp-style remote is caught too, by whichever rule sees it first
    ["Connecting to build.acme.internal", "host name"],
    ["pushed to github.com", "host name"],
    ["cwd /Users/alice/Workspace/secret-repo", "home directory"],
    ["cwd /home/bob/src", "home directory"],
  ];
  for (const [text, kind] of planted) expect([text, looksReal(text)]).toEqual([text, kind]);
  for (const fine of ["Edit src/limits.ts", "Read openspec/changes/x/tasks.md", "origin/main", "feat/add-rate-limiting", "/home/demo/work/atlas-api", "41 pass, 0 fail", "v1.2.3", "package.json"]) {
    expect([fine, looksReal(fine)]).toEqual([fine, undefined]);
  }
});

test("no transcript contains anything that looks real, and names only come from placeholders", () => {
  for (const [name, steps] of Object.entries(TRANSCRIPTS)) {
    const text = transcriptText(steps);
    expect([name, looksReal(text)]).toEqual([name, undefined]);
    // no absolute path is spelled out: paths come from {path}, which the player fills from the sample
    expect([name, /(^|[\s"'(])\/[A-Za-z]/.test(text.replaceAll("/opsx:", ""))]).toEqual([name, false]);
    // no sample name is hard-coded either, or the transcript would lie when played for another change
    for (const forbidden of ["atlas", "harbor", "lantern", "quill", "ember", "orbit"]) expect([name, text.includes(forbidden)]).toEqual([name, false]);
  }
  expect(looksReal(RECORDING_NOTICE)).toBeUndefined();
});

test("no seeded session, worktree, agent or profile contains anything that looks real; every path is under the fictional root", async () => {
  const api = createDemoApi({ now: () => Date.parse("2026-06-01T12:00:00.000Z"), latencyMs: 0 });
  const everything = [await api.sessions(), (await api.config()).agentSessions, DEMO_AGENT, DEMO_PROFILES, DEMO_CARRIED, await api.sharedConfig()];
  for (const text of strings(everything)) expect([text, looksReal(text)]).toEqual([text, undefined]);
  const { sessions, worktrees, agents } = await api.sessions();
  const paths = [...sessions.map((s) => s.worktreePath), ...worktrees.map((w) => w.path), ...agents.flatMap((a) => (a.path ? [a.path] : []))];
  expect(paths.length).toBeGreaterThan(10);
  for (const path of paths) expect([path, path.startsWith("/home/demo/")]).toEqual([path, true]);
});

test("the demo's agent is fictional and vendor-neutral", () => {
  expect([DEMO_AGENT.id, DEMO_AGENT.name, DEMO_AGENT.command[0]]).toEqual(["demo-agent", "Demo Agent", "demo-agent"]);
  const everything = strings([DEMO_AGENT, Object.values(TRANSCRIPTS).map(transcriptText)]).join("\n").toLowerCase();
  for (const vendor of ["claude", "anthropic", "openai", "codex", "gemini", "copilot", "cursor", "gpt"]) expect([vendor, everything.includes(vendor)]).toEqual([vendor, false]);
});

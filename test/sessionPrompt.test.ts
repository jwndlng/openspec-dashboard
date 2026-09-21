import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFetchHandler, type AppState } from "../src/server/api.ts";
import { Scanner } from "../src/server/scanner.ts";
import type { ChangeSnapshot, Session } from "../src/shared/types.ts";
import { useTempHome } from "./helpers.ts";
import { harness, waitFor, watch, type Harness } from "./sessionHelpers.ts";

setDefaultTimeout(30_000);

let cleanup: () => Promise<void>;
const managers: Harness["manager"][] = [];
beforeAll(async () => {
  ({ cleanup } = await useTempHome());
});
afterEach(async () => {
  for (const m of managers.splice(0)) await m.shutdown();
});
afterAll(() => cleanup());

const changeOf = (h: Harness, name: string) => h.snapshot.repos[0].changes.find((c) => c.name === name) as ChangeSnapshot;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("the next step is typed into the running session, and only the user's Enter sends it", async () => {
  const h = await harness();
  managers.push(h.manager);
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  const seen = await watch(h.manager, s.id);
  await waitFor(() => seen.text().includes("fake-agent ready"), "the agent");

  expect(h.manager.prompt(s.id, { action: "implement" }).id).toBe(s.id);
  await waitFor(() => seen.text().includes("implement upgrade-runtime"), "the prompt echoed by the terminal");
  await sleep(300);
  expect(seen.text()).not.toContain("you said:"); // nothing was sent: no Enter
  expect(h.manager.list().filter((x) => x.state === "running")).toHaveLength(1);

  h.manager.write(s.id, "\r");
  await waitFor(() => seen.text().includes("you said: implement upgrade-runtime"), "the prompt once the user pressed Enter");
});

test("prompt refusals: stage, archive, unknown action, not running, feature off", async () => {
  const h = await harness();
  managers.push(h.manager);
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  const refused = (action: unknown, id = s.id) => {
    try {
      h.manager.prompt(id, { action });
    } catch (err) {
      return (err as { status?: number }).status;
    }
    return 0;
  };
  expect(refused("draft")).toBe(400); // every artifact of the fixture's change is done
  expect(refused("archive")).toBe(400);
  expect(refused("ship")).toBe(400);
  expect(refused("implement", "nope")).toBe(404);

  h.config.agentSessions.enabled = false;
  expect(refused("implement")).toBe(403);
  h.config.agentSessions.enabled = true;

  h.manager.write(s.id, "exit\r");
  await waitFor(() => h.manager.get(s.id).state === "exited", "exit");
  expect(refused("implement")).toBe(409);
});

test("a draft session takes the implement prompt once the change is ready, and records it", async () => {
  const h = await harness();
  managers.push(h.manager);
  const change = changeOf(h, "upgrade-runtime");
  const artifacts = change.artifacts;
  Object.assign(change, { stage: artifacts[0].id, artifacts: artifacts.map((a, i) => (i === 0 ? { ...a, status: "ready" } : a)) });
  const s = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "draft" });
  expect(s.action).toBe("draft");
  Object.assign(change, { stage: "ready", artifacts }); // the agent finished drafting; the scanner noticed
  expect(h.manager.prompt(s.id, { action: "implement" }).action).toBe("implement");
});

test("archive runs in its own worktree next to the change's running session; the same starter twice is one session", async () => {
  const h = await harness();
  managers.push(h.manager);
  const a = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "implement" });
  Object.assign(changeOf(h, "upgrade-runtime"), { stage: "done" });
  const arch = await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "archive" });
  expect(arch.id).not.toBe(a.id);
  expect(arch.worktreePath).not.toBe(a.worktreePath);
  expect(arch.branch).toBe("chore/archive-upgrade-runtime");
  expect((await h.manager.open({ repoId: h.repoId, change: "upgrade-runtime", action: "archive" })).id).toBe(arch.id);
  expect(h.manager.list().filter((x) => x.state === "running")).toHaveLength(2);
  expect(() => h.manager.prompt(arch.id, { action: "implement" })).toThrow();
});

test("API: the prompt route is guarded, and the worktree route reports the work status as it is now", async () => {
  const h = await harness();
  managers.push(h.manager);
  const state: AppState = { config: h.config, scanner: new Scanner(() => h.config, { persist: false }, h.snapshot), sessions: h.manager };
  const handle = createFetchHandler({ state, indexHtml: "" });
  const post = (path: string, body: unknown, origin = "http://127.0.0.1:4173") => handle(new Request(`http://127.0.0.1:4173${path}`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) }));

  const s = (await (await post("/api/sessions", { repoId: h.repoId, change: "upgrade-runtime", action: "implement" })).json()) as Session;
  expect((await post(`/api/sessions/${s.id}/prompt`, { action: "implement" }, "https://evil.example")).status).toBe(403);
  expect((await post(`/api/sessions/${s.id}/prompt`, { action: "archive" })).status).toBe(400);
  expect((await post(`/api/sessions/${s.id}/prompt`, { action: "implement" })).status).toBe(200);

  await h.manager.worktrees(); // fill the list's cache, which must not be what the dialog sees
  await writeFile(join(s.worktreePath, "fresh.txt"), "x");
  const status = (await (await handle(new Request(`http://127.0.0.1:4173/api/sessions/${s.id}/worktree`))).json()) as { removable: boolean; work: { state: string; count: number } };
  expect(status.work).toMatchObject({ state: "uncommitted", count: 1 });
  expect(status.removable).toBe(false);
});

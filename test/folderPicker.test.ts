// The setup's folder dialog (openspec/specs/dashboard-api, "Setup folder picker endpoint"): one constant program per
// platform, nothing from the request on its command line, one at a time. A fake `zenity` stands in for the dialog, so
// no test ever opens a real one.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppState, createFetchHandler } from "../src/server/api.ts";
import { defaultConfig } from "../src/server/config.ts";
import { dashboardHome } from "../src/server/paths.ts";
import { Scanner } from "../src/server/scanner.ts";
import { type FolderPickerContext, folderPickerCommand, pickFolder, setupState } from "../src/server/setup.ts";
import type { FolderPickResult, SetupState } from "../src/shared/types.ts";
import { tempDir, useTempHome } from "./helpers.ts";

let cleanup: () => Promise<void>;
let dir: string;
let bin: string;
let chosen: string;
let record: string;

/**
 * Answers as `FAKE_PICKER_MODE` says — `chosen` prints `FAKE_PICKER_PATH` with a trailing slash as osascript does,
 * `cancel` exits 1 silently, `fail` complains, `wait` sleeps — and records its arguments, working directory and input.
 */
const FAKE_ZENITY = `#!/bin/sh
{ printf 'argv:'; for a in "$@"; do printf ' [%s]' "$a"; done; printf '\\ncwd: %s\\nstdin: ' "$(pwd)"; cat; printf '\\n'; env; } > "$FAKE_PICKER_RECORD"
case "$FAKE_PICKER_MODE" in
  chosen) printf '%s/\\n' "$FAKE_PICKER_PATH" ;;
  cancel) exit 1 ;;
  fail) echo "cannot open display" >&2; exit 5 ;;
  wait) exec sleep 2 ;;
esac
`;

function context(mode: string, extra: Partial<FolderPickerContext> = {}): FolderPickerContext {
  return {
    platform: "linux",
    env: { PATH: `${bin}:/usr/bin:/bin`, DISPLAY: ":0", FAKE_PICKER_MODE: mode, FAKE_PICKER_PATH: chosen, FAKE_PICKER_RECORD: record },
    home: dir,
    which: (command) => (command === "zenity" ? join(bin, "zenity") : undefined),
    ...extra,
  };
}

beforeAll(async () => {
  ({ cleanup } = await useTempHome());
  dir = realpathSync.native(await tempDir());
  bin = join(dir, "bin");
  chosen = join(dir, "acme");
  record = join(dir, "record.txt");
  await mkdir(bin);
  await mkdir(chosen);
  await writeFile(join(bin, "zenity"), FAKE_ZENITY);
  await chmod(join(bin, "zenity"), 0o755);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await cleanup();
});

const which = (found: string[]) => (command: string) => (found.includes(command) ? `/usr/bin/${command}` : undefined);

test("the command is a constant per platform", () => {
  const home = "/home/u";
  const mac = folderPickerCommand({ platform: "darwin", env: {}, home, which: which(["osascript"]) });
  expect(mac?.argv[0]).toBe("/usr/bin/osascript");
  expect(mac?.argv.join(" ")).toContain("choose folder");
  expect(mac?.cancelled(1, "execution error: User canceled. (-128)")).toBe(true);
  expect(mac?.cancelled(1, "something else")).toBe(false);
  const win = folderPickerCommand({ platform: "win32", env: {}, home, which: which(["powershell"]) });
  expect(win?.argv.slice(0, 2)).toEqual(["/usr/bin/powershell", "-NoProfile"]);
  expect(win?.argv.at(-1)).toContain("FolderBrowserDialog");
  const zenity = folderPickerCommand({ platform: "linux", env: { DISPLAY: ":0" }, home, which: which(["zenity", "kdialog"]) });
  expect(zenity?.argv[0]).toBe("/usr/bin/zenity");
  const kdialog = folderPickerCommand({ platform: "linux", env: { WAYLAND_DISPLAY: "wayland-0" }, home, which: which(["kdialog"]) });
  expect(kdialog?.argv).toEqual(["/usr/bin/kdialog", "--title", "Choose a workspace folder", "--getexistingdirectory", home]);
});

test("no picker without the program or, on Linux, without a graphical session", () => {
  expect(folderPickerCommand({ platform: "darwin", env: {}, home: "/h", which: which([]) })).toBeUndefined();
  expect(folderPickerCommand({ platform: "linux", env: {}, home: "/h", which: which(["zenity"]) })).toBeUndefined();
  expect(folderPickerCommand({ platform: "linux", env: { DISPLAY: ":0" }, home: "/h", which: which([]) })).toBeUndefined();
});

test("a chosen folder is answered canonically, from the dashboard home, with nothing on stdin", async () => {
  expect(await pickFolder(context("chosen"))).toEqual({ status: "chosen", path: chosen });
  const recorded = await readFile(record, "utf8");
  expect(recorded).toContain(`cwd: ${realpathSync.native(dashboardHome())}`);
  expect(recorded).toContain("stdin: \n");
  expect(recorded).toContain("[--directory]");
});

test("cancelling answers cancelled, a failure its reason", async () => {
  expect(await pickFolder(context("cancel"))).toEqual({ status: "cancelled" });
  expect(await pickFolder(context("fail"))).toEqual({ status: "failed", reason: "cannot open display" });
});

test("an answer that is not an existing folder is refused", async () => {
  const ctx = context("chosen");
  ctx.env.FAKE_PICKER_PATH = join(dir, "missing");
  expect((await pickFolder(ctx)).status).toBe("failed");
});

test("a dialog left open is closed and answered cancelled", async () => {
  expect(await pickFolder(context("wait"), 200)).toEqual({ status: "cancelled" });
});

test("without a picker nothing is started", async () => {
  const result = await pickFolder(context("chosen", { env: { PATH: bin } }));
  expect(result.status).toBe("failed");
});

test("setup reports whether a picker is available", async () => {
  expect((await setupState(defaultConfig(), dir, context("chosen"))).folderPicker).toBe(true);
  expect((await setupState(defaultConfig(), dir, context("chosen", { which: () => undefined }))).folderPicker).toBe(false);
});

test("POST /api/setup/folder: guarded, one at a time, the body never reaches the command line", async () => {
  const state: AppState = { config: defaultConfig(), scanner: undefined as unknown as Scanner, folderPicker: context("wait") };
  state.scanner = new Scanner(() => state.config, { persist: false });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createFetchHandler({ state, indexHtml: "<title>stub</title>" }) });
  const base = `http://127.0.0.1:${server.port}`;
  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/setup/folder`, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
  try {
    await rm(record, { force: true });
    expect((await post("{}", { origin: "https://example.com" })).status).toBe(403);
    expect(await Bun.file(record).exists()).toBe(false);

    state.folderPicker = context("wait");
    const first = post("{}");
    await Bun.sleep(150);
    expect((await post("{}")).status).toBe(409);
    state.folderPicker = context("chosen");
    expect(((await (await first).json()) as FolderPickResult).status).toBe("cancelled");

    const smuggled = JSON.stringify({ path: "/etc", script: "do shell script \"touch /tmp/x\"", argv: ["--evil"] });
    const res = await post(smuggled);
    expect(((await res.json()) as FolderPickResult)).toEqual({ status: "chosen", path: chosen });
    const recorded = await readFile(record, "utf8");
    for (const piece of ["/etc", "touch", "--evil"]) expect(recorded).not.toContain(piece);
    expect(state.config).toEqual(defaultConfig());

    expect(((await (await fetch(`${base}/api/setup`)).json()) as SetupState).folderPicker).toBe(true);
  } finally {
    state.scanner.stop();
    server.stop(true);
  }
});

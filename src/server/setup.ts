// The setup wizard's server side (openspec/specs/setup-wizard): whether setup is pending, which well-known folders in
// the home directory are worth offering as workspace roots, and the system's folder dialog. Everything the wizard saves
// goes through the existing config and tracking routes; the only write here is clearing the flag in the dashboard's
// own config — and a new workspace folder the user marked to be created, one empty directory made under New project's
// placement rules (`newFolder.ts`). The folder dialog is the one process the wizard may start here: a constant argument
// list, no shell, nothing from the request on its command line, and it writes nothing.
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { installPlatform } from "../shared/agentDefaults.ts";
import type { Config, FolderPickResult, SetupState } from "../shared/types.ts";
import { updateConfig } from "./config.ts";
import { isDirectory, makeNewFolder, NewFolderError, pathTaken, placementProblem } from "./newFolder.ts";
import { canonicalPath, dashboardHome, expandPath } from "./paths.ts";

/**
 * Checked one by one, directly in the home directory, in this order. A fixed list rather than a listing of the home
 * directory, so the answer says no more than "these well-known folders exist".
 */
export const SUGGESTED_ROOT_NAMES = ["Workspace", "workspace", "Projects", "projects", "Developer", "Code", "code", "src", "dev", "repos", "git", "GitHub"] as const;

/** `path` equals `base` or lies below it; `sep` so `/w/acme-old` is not read as inside `/w/acme`. */
function atOrBelow(path: string, base: string): boolean {
  return path === base || path.startsWith(base.endsWith(sep) ? base : base + sep);
}

/**
 * The folders of {@link SUGGESTED_ROOT_NAMES} that exist as directories in `home`, canonical (so `Projects` and
 * `projects` on a case-insensitive volume are one), without configured roots and anything at or below an ignore path.
 */
export async function suggestRoots(home: string, config: Pick<Config, "scanRoots" | "ignorePaths">): Promise<string[]> {
  const found: string[] = [];
  for (const name of SUGGESTED_ROOT_NAMES) {
    const candidate = join(home, name);
    try {
      if (!(await stat(candidate)).isDirectory()) continue;
    } catch {
      continue;
    }
    const path = canonicalPath(candidate);
    if (found.includes(path) || config.scanRoots.includes(path)) continue;
    if (config.ignorePaths.some((ignored) => atOrBelow(path, ignored))) continue;
    found.push(path);
  }
  return found;
}

export async function setupState(config: Config, home: string = homedir(), picker: FolderPickerContext = folderPickerContext()): Promise<SetupState> {
  return {
    pending: config.setup === "pending",
    home,
    suggestedRoots: await suggestRoots(home, config),
    platform: installPlatform(process.platform),
    folderPicker: folderPickerCommand(picker) !== undefined,
  };
}

/** Where the folder dialog is decided: the platform, the environment and how a program is found on the `PATH`. */
export interface FolderPickerContext {
  platform: string;
  env: Record<string, string | undefined>;
  home: string;
  which: (command: string) => string | undefined;
}

export function folderPickerContext(): FolderPickerContext {
  return { platform: process.platform, env: process.env, home: homedir(), which: (command) => Bun.which(command, { PATH: process.env.PATH ?? "" }) ?? undefined };
}

/** How a dialog's answer is read: what it printed on success, and whether a failed exit was the user cancelling. */
export interface FolderPickerCommand {
  argv: string[];
  cancelled: (code: number, stderr: string) => boolean;
}

const PICKER_PROMPT = "Choose a workspace folder";

/** PowerShell's folder dialog, printing the chosen path and nothing when cancelled. A constant: nothing is interpolated. */
const WINDOWS_PICKER_SCRIPT = [
  "Add-Type -AssemblyName System.Windows.Forms;",
  "$d = New-Object System.Windows.Forms.FolderBrowserDialog;",
  `$d.Description = '${PICKER_PROMPT}';`,
  "$d.SelectedPath = [Environment]::GetFolderPath('UserProfile');",
  "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }",
].join(" ");

/**
 * The one fixed program per platform that shows the system's folder dialog, resolved to an absolute path, or
 * `undefined` when this machine has none: `osascript` on macOS (`tell me to activate` brings the dialog in front of the
 * browser or the desktop window), `zenity` or else `kdialog` on Linux with a graphical session, PowerShell on Windows.
 * Only `home` — the server's own home directory — varies, as where the dialog starts.
 */
export function folderPickerCommand(context: FolderPickerContext): FolderPickerCommand | undefined {
  const { platform, env, home, which } = context;
  if (platform === "darwin") {
    const osascript = which("osascript");
    if (!osascript) return undefined;
    const script = `POSIX path of (choose folder with prompt "${PICKER_PROMPT}" default location (path to home folder))`;
    // -128 is AppleScript's "User canceled".
    return { argv: [osascript, "-e", "tell me to activate", "-e", script], cancelled: (code, stderr) => code !== 0 && /-128/.test(stderr) };
  }
  if (platform === "win32") {
    const powershell = which("powershell") ?? which("pwsh");
    if (!powershell) return undefined;
    return { argv: [powershell, "-NoProfile", "-NonInteractive", "-STA", "-Command", WINDOWS_PICKER_SCRIPT], cancelled: () => false };
  }
  if (!env.DISPLAY && !env.WAYLAND_DISPLAY) return undefined;
  // Both answer a cancel with exit code 1 and no output.
  const zenity = which("zenity");
  if (zenity) return { argv: [zenity, "--file-selection", "--directory", `--title=${PICKER_PROMPT}`, `--filename=${home.replace(/\/+$/, "")}/`], cancelled: (code) => code === 1 };
  const kdialog = which("kdialog");
  if (kdialog) return { argv: [kdialog, "--title", PICKER_PROMPT, "--getexistingdirectory", home], cancelled: (code) => code === 1 };
  return undefined;
}

/** How long a dialog may stay open before it is closed and answered as cancelled. */
export const FOLDER_PICKER_TIMEOUT_MS = 10 * 60_000;

/** Thrown for a second request while a dialog is open; the route answers `409`. */
export class FolderPickerBusyError extends Error {}

let pickerOpen = false;

/**
 * Opens the system's folder dialog and waits for the user. One dialog at a time; its working directory is the
 * dashboard home, never a tracked repository; stdin is closed, so nothing reaches it but the constant arguments.
 */
export async function pickFolder(context: FolderPickerContext = folderPickerContext(), timeoutMs = FOLDER_PICKER_TIMEOUT_MS): Promise<FolderPickResult> {
  const command = folderPickerCommand(context);
  if (!command) return { status: "failed", reason: "No folder dialog is available on this machine. Type the folder's path instead." };
  if (pickerOpen) throw new FolderPickerBusyError("A folder dialog is already open.");
  pickerOpen = true;
  try {
    const cwd = dashboardHome();
    await mkdir(cwd, { recursive: true }).catch(() => undefined);
    let timedOut = false;
    const proc = Bun.spawn(command.argv, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { ...context.env } });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    try {
      // The exit decides, not the pipes: a killed dialog's helper process could hold them open.
      const code = await proc.exited;
      if (timedOut) return { status: "cancelled" };
      const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
      if (code !== 0) {
        if (command.cancelled(code, err)) return { status: "cancelled" };
        const reason = err.trim().split("\n")[0] || `the folder dialog exited with code ${code}`;
        return { status: "failed", reason: reason.length > 200 ? `${reason.slice(0, 197)}…` : reason };
      }
      const printed = out.trim();
      if (!printed) return { status: "cancelled" };
      // A drive or file-system root keeps its separator; any other folder loses the trailing one osascript prints.
      const chosen = /^([A-Za-z]:)?[\\/]$/.test(printed) ? printed : printed.replace(/[\\/]+$/, "");
      return await chosenFolder(chosen);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof FolderPickerBusyError) throw err;
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  } finally {
    pickerOpen = false;
  }
}

/** What the dialog printed, accepted only as an existing directory, in its canonical spelling. */
async function chosenFolder(path: string): Promise<FolderPickResult> {
  try {
    if ((await stat(path)).isDirectory()) return { status: "chosen", path: canonicalPath(path) };
  } catch {
    // Falls through to the refusal below.
  }
  return { status: "failed", reason: "The folder dialog did not answer with an existing folder." };
}

/** Finish or Skip: drops the flag and nothing else; writes nothing when setup is not pending. */
export async function markSetupDone(state: { config: Config }): Promise<Config> {
  const { saved } = await updateConfig(state, (current) => {
    if (current.setup !== "pending") return undefined;
    const { setup: _, ...rest } = current;
    return rest;
  });
  return saved;
}

/**
 * The Workspace step's **Create folder** (setup-wizard): one new, empty directory with a non-recursive, exclusive
 * create, inside an existing directory and outside every tracked repository, ignore path and the home. Starts no
 * process and leaves the configuration alone — the wizard saves the root afterwards. Throws {@link NewFolderError}
 * with `400`, `404` or `409`; returns the folder's canonical path.
 */
export async function createWorkspaceFolder(config: Pick<Config, "repos" | "ignorePaths">, input: unknown): Promise<string> {
  const expanded = typeof input === "string" && input.trim() ? expandPath(input.trim()) : "";
  if (!expanded || !isAbsolute(expanded)) throw new NewFolderError(400, "the folder must be an absolute path (~ is accepted)");
  const parent = canonicalPath(dirname(expanded));
  if (!(await isDirectory(parent))) throw new NewFolderError(404, `its parent folder ${parent} does not exist`);
  const path = join(parent, basename(expanded));
  if (await pathTaken(path)) throw new NewFolderError(409, `${path} already exists`);
  const problem = placementProblem(config, path);
  if (problem) throw new NewFolderError(409, problem);
  await makeNewFolder(path);
  return canonicalPath(path);
}

// The setup wizard's server side (openspec/specs/setup-wizard): whether setup is pending, and which well-known folders
// in the home directory are worth offering as workspace roots. Everything the wizard saves goes through the existing
// config and tracking routes; the only write here is clearing the flag in the dashboard's own config.
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { installPlatform } from "../shared/agentDefaults.ts";
import type { Config, SetupState } from "../shared/types.ts";
import { updateConfig } from "./config.ts";
import { canonicalPath } from "./paths.ts";

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

export async function setupState(config: Config, home: string = homedir()): Promise<SetupState> {
  return { pending: config.setup === "pending", home, suggestedRoots: await suggestRoots(home, config), platform: installPlatform(process.platform) };
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

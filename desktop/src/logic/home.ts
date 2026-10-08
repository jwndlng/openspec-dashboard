// Where the app finds the server's home and port. A copy of the server's own rule (`homeBeforeMigration` in
// `src/server/index.ts`, `configuredPort` in `src/server/config.ts`), because the app starts the binary without
// `--port` and has to know where it will listen; `test/desktop/home.test.ts` keeps the two in step.
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_PORT = 4711;

export interface HomeInputs {
  env: Record<string, string | undefined>;
  /** The user's home directory (`os.homedir()`), a parameter so tests never touch the real `~`. */
  userHome: string;
}

function explicitHome(env: HomeInputs["env"]): string | undefined {
  return env.SPEC_CONTROL_HOME || env.OPENSPEC_DASHBOARD_HOME || undefined;
}

async function exists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}

/** The home the server reads its port from before it migrates: the explicit home, else the new home if it holds a config, else the pre-rename one. */
export async function portHome({ env, userHome }: HomeInputs): Promise<string> {
  const explicit = explicitHome(env);
  if (explicit) return explicit;
  const fresh = join(userHome, ".spec-control");
  return (await exists(join(fresh, "config.json"))) ? fresh : join(userHome, ".openspec-dashboard");
}

/** The port in `<home>/config.json`: an integer from 1024 to 65535, anything else (or nothing readable) the default. */
export async function configuredPortFor(home: string): Promise<number> {
  try {
    const port = (JSON.parse(await readFile(join(home, "config.json"), "utf8")) as { port?: unknown }).port;
    return typeof port === "number" && Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

/**
 * The home the app may keep its own files in, or undefined when it must not write one yet. When only the pre-rename
 * home exists, creating `~/.spec-control/` would leave the server's one-time home migration with two homes, which it
 * refuses to merge (`src/server/homeMigration.ts`); so the app writes nothing there until the server has moved it.
 */
export async function appHome({ env, userHome }: HomeInputs): Promise<string | undefined> {
  const explicit = explicitHome(env);
  if (explicit) return explicit;
  const fresh = join(userHome, ".spec-control");
  if (await exists(fresh)) return fresh;
  return (await exists(join(userHome, ".openspec-dashboard"))) ? undefined : fresh;
}

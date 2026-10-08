// The `PATH` of the user's login shell (design D4), so tools installed with Homebrew, npm and the like are found when
// the app is opened from Finder, where the process inherits only launchd's minimal `PATH`.

const SENTINEL = "__SC_PATH__";

/** Standard macOS `PATH` plus both Homebrew prefixes; used whenever the shell gives no answer. */
export function fallbackPath(): string {
  return "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
}

/** A non-interactive login shell that prints only `PATH`, between sentinels so banners a profile prints do not matter. */
export function shellPathCommand(shell: string | undefined): string[] {
  return [shell || "/bin/zsh", "-l", "-c", `printf '%s' "${SENTINEL}\${PATH}${SENTINEL}"`];
}

/** What the shell printed between the sentinels, or undefined when there is no complete, non-empty pair. */
export function parseShellPath(stdout: string): string | undefined {
  const start = stdout.indexOf(SENTINEL);
  if (start < 0) return undefined;
  const end = stdout.indexOf(SENTINEL, start + SENTINEL.length);
  if (end < 0) return undefined;
  const path = stdout.slice(start + SENTINEL.length, end).trim();
  return path === "" ? undefined : path;
}

/**
 * Runs the login shell once, with stdin closed and a time limit, and returns its `PATH` or the fallback. No other
 * variable is read from the shell, and the shell is run for nothing else.
 */
export async function loginShellPath(shell: string | undefined, timeoutMs = 5000): Promise<{ path: string; fromShell: boolean }> {
  try {
    const child = Bun.spawn(shellPathCommand(shell), { stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: timeoutMs, killSignal: "SIGKILL" });
    // Read as it comes, not to the end: something the profile started may keep the pipe open after the shell is gone.
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    let stdout = "";
    const drained = (async () => {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) stdout += decoder.decode(chunk.value, { stream: true });
    })().catch(() => undefined);
    const code = await child.exited;
    await Promise.race([drained, Bun.sleep(100)]);
    void reader.cancel().catch(() => undefined);
    const path = code === 0 ? parseShellPath(stdout) : undefined;
    if (path) return { path, fromShell: true };
  } catch {
    // no such shell: the fallback
  }
  return { path: fallbackPath(), fromShell: false };
}

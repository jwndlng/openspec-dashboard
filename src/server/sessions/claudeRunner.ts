// The one Runner implementation: the user's locally installed `claude` CLI, on the user's own login (design.md D2–D6).
// The dashboard never reads or forwards credentials; it only decides which environment variables the child inherits.
import type { AgentAvailability } from "../../shared/types.ts";
import { interruptLine, parseStreamLine, userMessageLine } from "./claudeStream.ts";
import type { ExitInfo, Runner, RunnerEvent, RunnerProcess, RunnerStartOptions } from "./runner.ts";

const STRIPPED_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];
const STDERR_LIMIT = 4000;

/**
 * Argument array for a session process. No shell is involved, and nothing here can carry a permission-bypass flag:
 * the mode is fixed to `dontAsk`, user-level settings are excluded so their allow rules cannot widen the list (O3),
 * and variadic flags are passed as a single `--flag=value` so they cannot swallow a neighbour (O8).
 */
export function buildClaudeArgs(options: RunnerStartOptions): string[] {
  const args = ["-p", "--verbose", "--output-format", "stream-json", "--input-format", "stream-json", "--replay-user-messages"];
  if (options.mode.kind === "fresh") args.push("--session-id", options.cliSessionId, "--worktree", options.mode.worktreeName);
  else args.push("--resume", options.cliSessionId);
  args.push("--setting-sources", "project", "--permission-mode", "dontAsk", `--allowedTools=${options.allowedTools.join(",")}`);
  for (const dir of options.addDirs) args.push("--add-dir", dir);
  args.push("--append-system-prompt", options.systemPrompt);
  return args;
}

export function childEnv(base: Record<string, string | undefined>, passApiKeyEnv: boolean): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (!passApiKeyEnv && STRIPPED_ENV.includes(key)) continue;
    env[key] = value;
  }
  return env;
}

async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      yield buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) yield buffer;
}

export class ClaudeRunner implements Runner {
  constructor(private readonly getPath: () => string) {}

  async available(): Promise<AgentAvailability> {
    try {
      const proc = Bun.spawn([this.getPath(), "--version"], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
      const out = (await new Response(proc.stdout).text()).trim();
      if ((await proc.exited) !== 0) return { available: false, reason: "the agent CLI did not report a version" };
      return { available: true, version: out.split("\n")[0] };
    } catch {
      return { available: false, reason: `agent CLI not found (${this.getPath()}); install Claude Code and run it once to log in` };
    }
  }

  start(options: RunnerStartOptions): RunnerProcess {
    const proc = Bun.spawn([this.getPath(), ...buildClaudeArgs(options)], {
      cwd: options.cwd,
      env: childEnv(process.env, options.passApiKeyEnv),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    let stderr = "";
    void (async () => {
      for await (const line of lines(proc.stderr)) stderr = `${stderr}${line}\n`.slice(-STDERR_LIMIT);
    })();

    async function* events(): AsyncGenerator<RunnerEvent> {
      for await (const line of lines(proc.stdout)) yield* parseStreamLine(line);
    }

    const write = (text: string) => {
      try {
        proc.stdin.write(text);
        proc.stdin.flush();
      } catch {
        // process already gone; its exit is reported through `exited`
      }
    };

    let interrupts = 0;
    const exited: Promise<ExitInfo> = proc.exited.then((code) => ({ code, stderr }));
    return {
      events: events(),
      send: (text) => write(userMessageLine(text)),
      interrupt: () => write(interruptLine(`interrupt-${++interrupts}`)),
      end: () => {
        try {
          proc.stdin.end();
        } catch {
          // already closed
        }
      },
      kill: () => proc.kill(),
      exited,
    };
  }
}

// Runner abstraction (design.md D1): the session manager talks to an agent CLI only through these types.
import type { AgentAvailability } from "../../shared/types.ts";

export interface PermissionDenial {
  tool: string;
  input?: unknown;
}

/** Normalised events, independent of the CLI's wire format. */
export type RunnerEvent =
  | { type: "init"; cwd?: string; cliSessionId?: string; apiKeySource?: string }
  | { type: "user"; text: string; replay: boolean }
  | { type: "assistant"; text: string }
  | { type: "tool_use"; id: string; name: string; input?: unknown }
  | { type: "tool_result"; id: string; content: string; isError: boolean }
  | { type: "rate_limit"; status: string; windows: Record<string, { utilization: number; resetsAt: number }> }
  | { type: "result"; isError: boolean; subtype?: string; text?: string; costUsd?: number; denials: PermissionDenial[]; terminalReason?: string }
  | { type: "control_response"; requestId?: string; ok: boolean }
  | { type: "unparsed"; raw: string };

export interface RunnerStartOptions {
  /** Repository root for a fresh session; the session's worktree when resuming. */
  cwd: string;
  cliSessionId: string;
  /** Fresh start creates/reuses the worktree of this name; resume continues `cliSessionId` in `cwd`. */
  mode: { kind: "fresh"; worktreeName: string } | { kind: "resume" };
  allowedTools: string[];
  /** Directories outside `cwd` the agent may read (the change directory in the main checkout). */
  addDirs: string[];
  systemPrompt: string;
  passApiKeyEnv: boolean;
}

export interface ExitInfo {
  code: number | null;
  stderr: string;
}

export interface RunnerProcess {
  events: AsyncIterable<RunnerEvent>;
  send(text: string): void;
  /** Ends the current turn but keeps the conversation process alive. */
  interrupt(): void;
  /** Asks the process to finish (closes its input). */
  end(): void;
  kill(): void;
  exited: Promise<ExitInfo>;
}

export interface Runner {
  available(): Promise<AgentAvailability>;
  start(options: RunnerStartOptions): RunnerProcess;
}

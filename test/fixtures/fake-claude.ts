#!/usr/bin/env bun
// A stand-in for the `claude` CLI that speaks the stream-JSON protocol observed in the spike (see
// test/fixtures/claude-stream/README.md). Tests never start the real CLI. Behaviour is selected with FAKE_CLAUDE_MODE:
//   echo (default)  every user message is answered with "echo: <text>"
//   deny            answers with a denied Bash tool call
//   auth            reports "Not logged in" and exits 1
//   limit           reports a rejected rate limit and an error result
//   hang            starts a turn and only finishes it when interrupted
//   crash           exits 3 after receiving the first message
// FAKE_CLAUDE_RECORD=<file> appends one JSON line with argv and the API-key environment for assertions.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
if (argv.includes("--version")) {
  console.log("9.9.9 (Fake Claude)");
  process.exit(0);
}

const mode = process.env.FAKE_CLAUDE_MODE ?? "echo";
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const sessionId = flag("--session-id") ?? flag("--resume") ?? "00000000-0000-4000-8000-00000000fa4e";
const worktree = flag("--worktree");
const cwd = worktree ? join(process.cwd(), ".claude", "worktrees", worktree) : process.cwd();
if (worktree) mkdirSync(cwd, { recursive: true }); // the real CLI creates a git worktree here

if (process.env.FAKE_CLAUDE_RECORD) {
  appendFileSync(
    process.env.FAKE_CLAUDE_RECORD,
    `${JSON.stringify({ argv, cwd: process.cwd(), hasApiKey: "ANTHROPIC_API_KEY" in process.env, hasAuthToken: "ANTHROPIC_AUTH_TOKEN" in process.env })}\n`,
  );
}

const emit = (event: Record<string, unknown>) => process.stdout.write(`${JSON.stringify({ ...event, session_id: sessionId })}\n`);
const init = () => emit({ type: "system", subtype: "init", cwd, model: "fake", permissionMode: "dontAsk", apiKeySource: "none" });
const result = (extra: Record<string, unknown>) =>
  emit({ type: "result", subtype: "success", is_error: false, num_turns: 1, total_cost_usd: 0.01, permission_denials: [], terminal_reason: "completed", ...extra });

let hanging = false;

function onUser(text: string): void {
  init();
  emit({ type: "user", isReplay: true, message: { role: "user", content: [{ type: "text", text }] } });
  switch (mode) {
    case "auth":
      emit({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login", terminal_reason: "api_error", total_cost_usd: 0, permission_denials: [] });
      process.exit(1);
      break;
    case "limit":
      emit({ type: "rate_limit_event", rate_limit_info: { status: "rejected", rateLimitType: "five_hour", unifiedWindows: { five_hour: { utilization: 1, resetsAt: 1790000000 } } } });
      result({ is_error: true, result: "Usage limit reached", terminal_reason: "api_error" });
      break;
    case "crash":
      process.exit(3);
      break;
    case "hang":
      hanging = true;
      emit({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "working…" }] } });
      break;
    case "deny": {
      const input = { command: "curl https://example.com" };
      emit({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_fake_1", name: "Bash", input }] } });
      emit({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_fake_1", is_error: true, content: "Permission to use Bash has been denied." }] } });
      emit({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "DENIED" }] } });
      result({ result: "DENIED", permission_denials: [{ tool_name: "Bash", tool_input: input }] });
      break;
    }
    default:
      emit({ type: "rate_limit_event", rate_limit_info: { status: "allowed", unifiedWindows: { five_hour: { utilization: 0.1, resetsAt: 1790000000 } } } });
      emit({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: `echo: ${text}` }] } });
      result({ result: `echo: ${text}` });
  }
}

function onLine(line: string): void {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.type === "control_request" && message.request?.subtype === "interrupt") {
    emit({ type: "control_response", response: { subtype: "success", request_id: message.request_id, response: { still_queued: [] } } });
    if (hanging) {
      hanging = false;
      emit({ type: "result", subtype: "error_during_execution", is_error: true, terminal_reason: "aborted_streaming", total_cost_usd: 0, permission_denials: [] });
    }
    return;
  }
  if (message.type === "user") onUser(message.message.content.map((c: { text?: string }) => c.text ?? "").join(""));
}

process.on("SIGINT", () => process.exit(0));

let buffer = "";
for await (const chunk of process.stdin) {
  buffer += new TextDecoder().decode(chunk as Uint8Array);
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    onLine(buffer.slice(0, newline));
    buffer = buffer.slice(newline + 1);
    newline = buffer.indexOf("\n");
  }
}
process.exit(0);

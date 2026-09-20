// Translates the `claude` CLI's stream-JSON lines into RunnerEvents (observations O2, O3, O6, O7 in design.md).
// Pure, so it is tested against the recorded fixtures in test/fixtures/claude-stream/.
import type { PermissionDenial, RunnerEvent } from "./runner.ts";

type Json = Record<string, unknown>;

function asText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c === "object" && typeof (c as Json).text === "string" ? ((c as Json).text as string) : ""))
      .filter(Boolean)
      .join("\n");
  }
  return content === undefined || content === null ? "" : JSON.stringify(content);
}

function windows(info: Json): Record<string, { utilization: number; resetsAt: number }> {
  const out: Record<string, { utilization: number; resetsAt: number }> = {};
  const unified = info.unifiedWindows;
  if (unified && typeof unified === "object") {
    for (const [name, value] of Object.entries(unified as Json)) {
      const w = value as Json;
      if (typeof w?.utilization === "number" && typeof w?.resetsAt === "number") out[name] = { utilization: w.utilization, resetsAt: w.resetsAt };
    }
  }
  return out;
}

export function parseStreamLine(line: string): RunnerEvent[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  let e: Json;
  try {
    e = JSON.parse(trimmed) as Json;
  } catch {
    return [{ type: "unparsed", raw: trimmed.slice(0, 500) }];
  }

  switch (e.type) {
    case "system":
      if (e.subtype !== "init") return []; // token-progress and similar noise
      return [{ type: "init", cwd: e.cwd as string | undefined, cliSessionId: e.session_id as string | undefined, apiKeySource: e.apiKeySource as string | undefined }];

    case "rate_limit_event": {
      const info = (e.rate_limit_info ?? {}) as Json;
      return [{ type: "rate_limit", status: String(info.status ?? "unknown"), windows: windows(info) }];
    }

    case "assistant": {
      const content = ((e.message as Json | undefined)?.content ?? []) as Json[];
      const events: RunnerEvent[] = [];
      for (const block of Array.isArray(content) ? content : []) {
        if (block.type === "text" && typeof block.text === "string" && block.text) events.push({ type: "assistant", text: block.text });
        else if (block.type === "tool_use") events.push({ type: "tool_use", id: String(block.id ?? ""), name: String(block.name ?? "tool"), input: block.input });
        // thinking blocks are deliberately dropped
      }
      return events;
    }

    case "user": {
      const content = (e.message as Json | undefined)?.content;
      if (typeof content === "string") return [{ type: "user", text: content, replay: Boolean(e.isReplay) }];
      const events: RunnerEvent[] = [];
      for (const block of Array.isArray(content) ? (content as Json[]) : []) {
        if (block.type === "text" && typeof block.text === "string") events.push({ type: "user", text: block.text, replay: Boolean(e.isReplay) });
        else if (block.type === "tool_result") events.push({ type: "tool_result", id: String(block.tool_use_id ?? ""), content: asText(block.content), isError: Boolean(block.is_error) });
      }
      return events;
    }

    case "result": {
      const denials: PermissionDenial[] = Array.isArray(e.permission_denials)
        ? (e.permission_denials as Json[]).map((d) => ({ tool: String(d.tool_name ?? "tool"), input: d.tool_input }))
        : [];
      return [
        {
          type: "result",
          isError: Boolean(e.is_error),
          subtype: e.subtype as string | undefined,
          text: typeof e.result === "string" ? e.result : undefined,
          costUsd: typeof e.total_cost_usd === "number" ? e.total_cost_usd : undefined,
          denials,
          terminalReason: e.terminal_reason as string | undefined,
        },
      ];
    }

    case "control_response": {
      const response = (e.response ?? {}) as Json;
      return [{ type: "control_response", requestId: response.request_id as string | undefined, ok: response.subtype === "success" }];
    }

    default:
      return [];
  }
}

/** One user turn in the CLI's streamed-input format (O2). */
export function userMessageLine(text: string): string {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } })}\n`;
}

/** In-band interrupt: ends the turn, keeps the process (O7). */
export function interruptLine(requestId: string): string {
  return `${JSON.stringify({ type: "control_request", request_id: requestId, request: { subtype: "interrupt" } })}\n`;
}

// Probe, attach or start (design D3): what is on the configured port decides whether the app shows a running Spec
// Control, starts the bundled binary, or explains that another program holds the port.

export type Probe = { kind: "answered"; status: number; body: string } | { kind: "refused" } | { kind: "timeout" } | { kind: "failed"; message: string };

export type StartDecision = { action: "attach"; version: string } | { action: "start" } | { action: "blocked"; port: number; detail: string };

/** The body `GET /api/version` returns from a Spec Control, or undefined for anything else. */
export function specControlVersion(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as { name?: unknown; version?: unknown };
    if (parsed && parsed.name === "spec-control" && typeof parsed.version === "string") return parsed.version;
  } catch {
    // not JSON: not a Spec Control
  }
  return undefined;
}

export function decideStart(probe: Probe, port: number): StartDecision {
  if (probe.kind === "refused") return { action: "start" };
  if (probe.kind === "answered" && probe.status === 200) {
    const version = specControlVersion(probe.body);
    if (version !== undefined) return { action: "attach", version };
  }
  const detail =
    probe.kind === "timeout"
      ? "it did not answer within a second"
      : probe.kind === "failed"
        ? probe.message
        : `it answered ${probe.status} and is not Spec Control`;
  return { action: "blocked", port, detail };
}

/** True for the error `fetch` raises when nothing listens on the port. */
function isRefused(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "ConnectionRefused" || code === "ECONNREFUSED";
}

/** `GET /api/version` on the loopback port, with a time limit. Only ever `127.0.0.1`: the app contacts nothing else. */
export async function probeVersion(port: number, timeoutMs = 1000): Promise<Probe> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    return { kind: "answered", status: res.status, body: await res.text() };
  } catch (err) {
    if (isRefused(err)) return { kind: "refused" };
    if ((err as { name?: unknown })?.name === "TimeoutError") return { kind: "timeout" };
    return { kind: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}

/** The port in the binary's `spec-control listening on http://127.0.0.1:<port>` line, if the text holds one. */
export function listeningPort(output: string): number | undefined {
  const match = /spec-control listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
  return match ? Number(match[1]) : undefined;
}

export type WaitOutcome = "ready" | "exited" | "timeout";

/**
 * Polls `GET /api/version` until a Spec Control answers, the child exits, or the time is up (design D3: every 200 ms,
 * at most 15 s). `exited` is checked before every probe so a child that died is reported as such, not as a timeout.
 */
export async function waitForServer(options: {
  port: number;
  exited: () => boolean;
  probe?: (port: number) => Promise<Probe>;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<WaitOutcome> {
  const { port, exited, probe = probeVersion, timeoutMs = 15_000, intervalMs = 200 } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited()) return "exited";
    const answer = await probe(port);
    if (decideStart(answer, port).action === "attach") return "ready";
    await Bun.sleep(intervalMs);
  }
  return exited() ? "exited" : "timeout";
}

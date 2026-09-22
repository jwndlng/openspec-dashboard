// CLI entry point: `openspec-dashboard [--port N] [--no-open] [--version]`.
import indexHtmlAsset from "../../dist/ui/index.html" with { type: "text" };
import { createFetchHandler, createWebSocketHandlers, type AppState, type TerminalSocketData } from "./api.ts";
import { diffSnapshots, sessionEvent } from "./activity/events.ts";
import { ActivityLog } from "./activity/log.ts";
import { readSnapshot } from "./cache.ts";
import { loadConfig } from "./config.ts";
import { Scanner } from "./scanner.ts";
import { SessionManager } from "./sessions/manager.ts";
import { VERSION } from "./version.ts";

// With `type: "text"` Bun hands us the file contents; bun-types only knows the HTMLBundle shape.
const indexHtml = indexHtmlAsset as unknown as string;

interface CliArgs {
  port?: number;
  open: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { open: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-open") args.open = false;
    else if (arg === "--port") args.port = Number(argv[++i]);
    else if (arg.startsWith("--port=")) args.port = Number(arg.slice("--port=".length));
    else if (arg === "-h" || arg === "--help") {
      console.log(`openspec-dashboard ${VERSION}\nusage: openspec-dashboard [--port N] [--no-open] [--version]`);
      process.exit(0);
    } else if (arg === "--version") {
      console.log(VERSION);
      process.exit(0);
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (args.port !== undefined && !(Number.isInteger(args.port) && args.port > 0 && args.port < 65536)) {
    console.error("--port must be an integer between 1 and 65535");
    process.exit(2);
  }
  return args;
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? ["open", url] : process.platform === "win32" ? ["cmd", "/c", "start", "", url] : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).unref();
  } catch {
    // no browser available; the URL is printed anyway
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { config, warning } = await loadConfig();
  if (warning) console.warn(`warning: ${warning}`);

  // History for the Activity view: what changed between consecutive snapshots, plus what the session manager reports.
  const activity = new ActivityLog();
  await activity.load();
  const state: AppState = {
    config,
    activity,
    scanner: new Scanner(
      () => state.config,
      { onSnapshots: (previous, next) => void activity.append(diffSnapshots(previous, next, { now: new Date(), pollIntervalSeconds: state.config.pollIntervalSeconds })) },
      (await readSnapshot()) ?? undefined,
    ),
  };
  state.sessions = new SessionManager({
    getConfig: () => state.config,
    getSnapshot: () => state.scanner.snapshot,
    onActivity: (session, what) => void activity.append([sessionEvent(session, state.config.repos.find((r) => r.id === session.repoId)?.name ?? session.repoId, what)]),
  });
  await state.sessions.init();
  state.scanner.start();

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: args.port ?? config.port,
    fetch: createFetchHandler({ state, indexHtml }),
    websocket: createWebSocketHandlers(state) as unknown as Bun.WebSocketHandler<TerminalSocketData>,
  });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(`openspec-dashboard listening on ${url}`);
  if (args.open) openBrowser(url);

  const shutdown = () => {
    state.scanner.stop();
    // Children must not outlive the dashboard; sessions in flight become `interrupted` and can be resumed.
    void (state.sessions?.shutdown() ?? Promise.resolve()).finally(() => {
      server.stop(true);
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();

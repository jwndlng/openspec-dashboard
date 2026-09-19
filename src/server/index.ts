// CLI entry point: `openspec-dashboard [--port N] [--no-open]`.
import indexHtmlAsset from "../../dist/ui/index.html" with { type: "text" };
import { createFetchHandler, type AppState } from "./api.ts";
import { readSnapshot } from "./cache.ts";
import { loadConfig } from "./config.ts";
import { Scanner } from "./scanner.ts";

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
      console.log("usage: openspec-dashboard [--port N] [--no-open]");
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

  const state: AppState = {
    config,
    scanner: new Scanner(() => state.config, {}, (await readSnapshot()) ?? undefined),
  };
  state.scanner.start();

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: args.port ?? config.port,
    fetch: createFetchHandler({ state, indexHtml }),
  });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(`openspec-dashboard listening on ${url}`);
  if (args.open) openBrowser(url);

  const shutdown = () => {
    state.scanner.stop();
    server.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();

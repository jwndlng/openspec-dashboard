// Renders the demo build in headless Chrome and writes the README/demo-site screenshots to dist/demo/screenshots/.
// The demo build is the only possible input: no server is started and no URL is accepted, so a screenshot can never
// show anyone's real dashboard. Needs a local Chrome or Chromium (set CHROME_BIN to point at one); no npm dependency.
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(import.meta.dir, "..");
const demo = join(root, "dist", "demo", "index.html");
const outDir = join(root, "dist", "demo", "screenshots");

const SHOTS = [
  { name: "board", route: "#/board", width: 2560, height: 1300 },
  { name: "overview", route: "#/", width: 1440, height: 440 },
];
// Blink's PreferredColorScheme enum; the page follows prefers-color-scheme when nothing is stored.
const THEMES = [
  { name: "dark", blink: 0 },
  { name: "light", blink: 1 },
];
const RUN_TIMEOUT_MS = 45_000;
const MIN_PNG_BYTES = 10_000;

const CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function fail(message: string): never {
  console.error(`screenshots: ${message}`);
  process.exit(1);
}

const chrome = CANDIDATES.find((path): path is string => !!path && existsSync(path));
if (!chrome) fail("no Chrome or Chromium found. Install one, or set CHROME_BIN to its executable.");
if (!existsSync(demo)) fail("dist/demo/index.html is missing. Run `bun run build:demo` first.");

/** Headless Chrome sometimes writes its output and then does not exit while the page keeps polling; never wait for it. */
async function runChrome(args: string[], profile: string): Promise<string> {
  const proc = Bun.spawn(
    [chrome as string, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-sandbox", `--user-data-dir=${profile}`, "--virtual-time-budget=4000", ...args],
    { stdout: "pipe", stderr: "ignore" },
  );
  const timer = setTimeout(() => proc.kill(), RUN_TIMEOUT_MS);
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  clearTimeout(timer);
  return out;
}

await mkdir(outDir, { recursive: true });
const profiles = await mkdtemp(join(tmpdir(), "openspec-dashboard-shots-"));
try {
  for (const theme of THEMES) {
    const scheme = `--blink-settings=preferredColorScheme=${theme.blink}`;
    const url = (route: string) => `${pathToFileURL(demo).href}${route}`;

    // Prove the colour scheme took effect before trusting the pictures.
    const dom = await runChrome([scheme, "--dump-dom", url("#/board")], join(profiles, `${theme.name}-dom`));
    if (!dom.includes(`data-theme="${theme.name}"`)) fail(`could not force the ${theme.name} theme (Blink setting ignored?)`);
    if (!dom.includes("demo-banner") || !dom.includes('class="card')) fail("the demo did not render its board");

    for (const shot of SHOTS) {
      const file = join(outDir, `${shot.name}-${theme.name}.png`);
      await rm(file, { force: true });
      await runChrome([scheme, `--window-size=${shot.width},${shot.height}`, `--screenshot=${file}`, url(shot.route)], join(profiles, `${shot.name}-${theme.name}`));
      if (!existsSync(file) || statSync(file).size < MIN_PNG_BYTES) fail(`${shot.name}-${theme.name}.png was not produced`);
      console.log(`wrote ${join("dist", "demo", "screenshots", `${shot.name}-${theme.name}.png`)} (${Math.round(statSync(file).size / 1024)} KB)`);
    }
  }
} finally {
  await rm(profiles, { recursive: true, force: true });
}

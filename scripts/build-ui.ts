// Builds the SPA into a single self-contained dist/ui/index.html (JS, CSS and
// fonts inlined) so the server can embed one text asset in the compiled binary.
// `build-ui.ts demo` builds the demo instead: the same UI on the in-memory API and sample data, as
// dist/demo/index.html, for static hosting. Only that file carries the demo marker and the sample data.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DEMO_MARKER } from "../src/ui/demo/sampleData.ts";
import { THEME_STORAGE_KEY } from "../src/ui/theme.ts";

const root = join(import.meta.dir, "..");
const ui = join(root, "src", "ui");

interface Target {
  entry: string;
  outDir: string;
  title: string;
  /** Appended after styles.css. */
  extraCss?: string;
  /** HTML comment at the top of the document. */
  marker?: string;
}

const TARGETS: Record<string, Target> = {
  ui: { entry: join(ui, "main.tsx"), outDir: join(root, "dist", "ui"), title: "OpenSpec Dashboard" },
  demo: {
    entry: join(ui, "demo", "main.tsx"),
    outDir: join(root, "dist", "demo"),
    title: "OpenSpec Dashboard — Demo",
    extraCss: join(ui, "demo", "demo.css"),
    marker: DEMO_MARKER,
  },
};

const targetName = process.argv[2] ?? "ui";
const target = TARGETS[targetName];
if (!target) {
  console.error(`unknown target "${targetName}"; expected one of: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

const FONTS = [
  { family: "Space Grotesk", file: "SpaceGrotesk.woff2", weight: "300 700" },
  { family: "JetBrains Mono", file: "JetBrainsMono.woff2", weight: "100 800" },
];

async function fontFaces(): Promise<string> {
  const faces = await Promise.all(
    FONTS.map(async ({ family, file, weight }) => {
      const bytes = await Bun.file(join(ui, "fonts", file)).arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
    }),
  );
  return faces.join("\n");
}

const build = await Bun.build({
  entrypoints: [target.entry],
  target: "browser",
  minify: true,
  sourcemap: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
const js = (await build.outputs[0].text()).replaceAll("</script", "<\\/script");
const css = [await Bun.file(join(ui, "styles.css")).text(), target.extraCss ? await Bun.file(target.extraCss).text() : ""].join("\n");

// Runs before first paint so the stored/system theme never flashes the other one.
// Mirrors parsePreference + resolveTheme in src/ui/theme.ts.
const themeScript = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){try{t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="dark"}}document.documentElement.dataset.theme=t})()`;

const html = `<!doctype html>
${target.marker ? `<!-- ${target.marker} -->\n` : ""}<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${target.title}</title>
<script>${themeScript}</script>
<style>
${await fontFaces()}
${css}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">${js}</script>
</body>
</html>
`;

await mkdir(target.outDir, { recursive: true });
await Bun.write(join(target.outDir, "index.html"), html);
console.log(`built ${join("dist", targetName, "index.html")} (${(html.length / 1024).toFixed(0)} KB)`);

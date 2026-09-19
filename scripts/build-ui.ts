// Builds the SPA into a single self-contained dist/ui/index.html (JS, CSS and
// fonts inlined) so the server can embed one text asset in the compiled binary.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { THEME_STORAGE_KEY } from "../src/ui/theme.ts";

const root = join(import.meta.dir, "..");
const ui = join(root, "src", "ui");
const outDir = join(root, "dist", "ui");

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
  entrypoints: [join(ui, "main.tsx")],
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
const css = await Bun.file(join(ui, "styles.css")).text();

// Runs before first paint so the stored/system theme never flashes the other one.
// Mirrors parsePreference + resolveTheme in src/ui/theme.ts.
const themeScript = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){try{t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="dark"}}document.documentElement.dataset.theme=t})()`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>OpenSpec Dashboard</title>
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

await mkdir(outDir, { recursive: true });
await Bun.write(join(outDir, "index.html"), html);
console.log(`built ${join("dist", "ui", "index.html")} (${(html.length / 1024).toFixed(0)} KB)`);

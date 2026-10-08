// Prepares what the Electrobun build copies into the app: the `spec-control` binary from ../dist (built first with
// `bun run build` in the repository root) and the app and menu bar icons, drawn from the same mark as the favicon
// (src/ui/logoMark.ts) and rasterised with AppKit (`rasterise.swift`), so no image is checked in.
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAVICON_STROKE_SCALE, FAVICON_VIEWBOX, faviconSvg, MARK_PARTS, MARK_SQUARE, type MarkPart } from "../../src/ui/logoMark.ts";

const desktop = join(import.meta.dir, "..");
const assets = join(desktop, "build-assets");
const binary = join(desktop, "..", "dist", "spec-control");

function attrsOf(part: MarkPart, extra: Record<string, number | string>): string {
  const attrs: Record<string, number | string> = { ...part.attrs, ...extra };
  if (part.at) attrs.transform = `translate(${part.at[0]} ${part.at[1]})`;
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

/** The app icon: the favicon on a rounded square, with the margin macOS icons keep around their body. */
function appIconSvg(): string {
  const mark = faviconSvg().replace("<svg ", '<svg x="232" y="232" width="560" height="560" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect x="100" y="100" width="824" height="824" rx="185" fill="#26272b"/>${mark}</svg>`;
}

/**
 * The menu bar icon as a template image: black on transparent, macOS tints it. The nodes hide the square's outline
 * behind them with a mask, since a template has no ground colour to paint them with.
 */
function trayTemplateSvg(): string {
  const parts = MARK_PARTS.filter((part) => !part.detail);
  const stroke = (part: MarkPart) => (part.strokeWidth === undefined ? {} : { stroke: "#000", "stroke-width": +(part.strokeWidth * FAVICON_STROKE_SCALE).toFixed(2) });
  const holes = parts.filter((p) => p.fill === "ground").map((p) => `<${p.el} ${attrsOf(p, { fill: "#000" })}/>`);
  const body = parts.map((p) => {
    if (p === MARK_SQUARE) return `<${p.el} ${attrsOf(p, { fill: "none", ...stroke(p), mask: "url(#nodes)" })}/>`;
    return `<${p.el} ${attrsOf(p, { fill: p.fill === "ink" ? "#000" : "none", ...stroke(p) })}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FAVICON_VIEWBOX}"><mask id="nodes"><rect x="0" y="0" width="128" height="128" fill="#fff"/>${holes.join("")}</mask>${body.join("")}</svg>`;
}

async function run(cmd: string[]): Promise<void> {
  const child = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  if ((await child.exited) !== 0) throw new Error(`${cmd.join(" ")} failed: ${await new Response(child.stderr).text()}`);
}

/** Every image in one run of `rasterise.swift` (AppKit), since starting Swift is what takes the time. */
async function rasterise(images: { svg: string; outputs: [string, number][] }[]): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "spec-control-icons-"));
  try {
    const args: string[] = [];
    for (const [i, image] of images.entries()) {
      const source = join(work, `image-${i}.svg`);
      await writeFile(source, image.svg);
      for (const [path, size] of image.outputs) args.push(source, path, String(size));
    }
    await run(["swift", join(import.meta.dir, "rasterise.swift"), ...args]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (!(await Bun.file(binary).exists())) {
  console.error(`missing ${binary}: run \`bun run build\` in the repository root first`);
  process.exit(1);
}
await rm(assets, { recursive: true, force: true });
await mkdir(join(assets, "icon.iconset"), { recursive: true });
await copyFile(binary, join(assets, "spec-control"));

const iconset = join(assets, "icon.iconset");
await rasterise([
  {
    svg: appIconSvg(),
    outputs: [16, 32, 128, 256, 512].flatMap((size): [string, number][] => [
      [join(iconset, `icon_${size}x${size}.png`), size],
      [join(iconset, `icon_${size}x${size}@2x.png`), size * 2],
    ]),
  },
  {
    svg: trayTemplateSvg(),
    outputs: [
      [join(assets, "tray-Template.png"), 18],
      [join(assets, "tray-Template@2x.png"), 36],
    ],
  },
]);
console.log(`prepared ${assets}`);

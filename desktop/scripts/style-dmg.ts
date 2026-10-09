// Lays out the disk image as an installer window (openspec/changes/styled-dmg-installer, design D1–D6). Run as the
// `postPackage` hook, after Electrobun made its `.dmg` in ELECTROBUN_ARTIFACT_DIR: the app is copied out of that image
// unchanged with `ditto`, a writable image named Spec Control is built around it with an Applications link and the
// background, Finder lays out its window (AppleScript), and the result is converted back to the original image's format
// and checked before it replaces the original. Only macOS's own tools. A Developer ID build keeps Electrobun's image,
// whose signature and notarisation a rebuild would drop.
import { copyFile, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME, APPLICATIONS_NAME, BACKGROUND_DIR, BACKGROUND_FILE, backgroundSvg, finderLayoutScript, VOLUME_NAME, WINDOW } from "./dmgLayout.ts";

const MOUNT_POINT = join("/Volumes", VOLUME_NAME);
const LAYOUT_ATTEMPTS = 3;
const LAYOUT_TIMEOUT_MS = 60_000;

function fail(message: string): never {
  throw new Error(message);
}

function run(cmd: string[], what = cmd.slice(0, 2).join(" ")): string {
  const result = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) fail(`${what} failed: ${result.stderr.toString().trim() || result.stdout.toString().trim()}`);
  return result.stdout.toString();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every device this script attached, detached again in `finally` whatever happened. */
const attached: string[] = [];

/** Attaches `image` and returns its device and mount point, read from `hdiutil`'s plist output. */
function attach(image: string, options: string[]): { device: string; mount: string } {
  const plist = run(["hdiutil", "attach", "-plist", "-noautoopen", ...options, image], `hdiutil attach ${image}`);
  const json = Bun.spawnSync(["plutil", "-convert", "json", "-o", "-", "-"], { stdin: Buffer.from(plist), stdout: "pipe" });
  const entities: { "dev-entry"?: string; "mount-point"?: string }[] = JSON.parse(json.stdout.toString())["system-entities"] ?? [];
  const device = entities.map((e) => e["dev-entry"]).find((d): d is string => Boolean(d && /^\/dev\/disk\d+$/.test(d)));
  if (device) attached.push(device);
  const mount = entities.map((e) => e["mount-point"]).find((m): m is string => Boolean(m));
  if (!device || !mount) fail(`hdiutil attach ${image} mounted no volume`);
  return { device, mount };
}

/** Detaches `device`, giving Finder a few seconds to let go of it before forcing. */
async function detach(device: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (Bun.spawnSync(["hdiutil", "detach", device], { stdout: "ignore", stderr: "ignore" }).exitCode === 0) break;
    await sleep(1000);
    if (attempt === 4) Bun.spawnSync(["hdiutil", "detach", "-force", device], { stdout: "ignore", stderr: "ignore" });
  }
  attached.splice(attached.indexOf(device), 1);
}

/** The background at the window's size and at twice it, in one TIFF Finder picks from by screen scale. */
async function drawBackground(work: string, out: string): Promise<void> {
  const svg = join(work, "background.svg");
  const png1x = join(work, "background.png");
  const png2x = join(work, "background@2x.png");
  await writeFile(svg, backgroundSvg());
  run(["swift", join(import.meta.dir, "rasterise.swift"), svg, png1x, `${WINDOW.width}x${WINDOW.height}`, svg, png2x, `${WINDOW.width * 2}x${WINDOW.height * 2}`], "rasterise.swift");
  run(["tiffutil", "-cathidpicheck", png1x, png2x, "-out", out], "tiffutil");
}

/** Finder writes the layout into `.DS_Store`; tried a few times, since Finder can be slow to answer. */
async function layOut(mount: string): Promise<void> {
  const store = join(mount, ".DS_Store");
  let error = "";
  for (let attempt = 1; attempt <= LAYOUT_ATTEMPTS; attempt++) {
    // Finder cannot open a window while the screen is locked and would keep the script waiting.
    const result = Bun.spawnSync(["osascript", "-e", finderLayoutScript()], { stdout: "pipe", stderr: "pipe", timeout: LAYOUT_TIMEOUT_MS });
    error = result.exitCode === null ? `Finder did not answer within ${LAYOUT_TIMEOUT_MS / 1000} seconds` : result.stderr.toString().trim();
    if (result.exitCode === 0) {
      for (let wait = 0; wait < 20 && !existsSync(store); wait++) await sleep(500);
      if (existsSync(store)) return;
      error = "Finder wrote no .DS_Store";
    }
    // -1743: not allowed to send Apple events. Retrying does not help; the user has to allow it.
    if (error.includes("-1743")) break;
    console.error(`style-dmg: laying out the window failed (attempt ${attempt} of ${LAYOUT_ATTEMPTS}): ${error}`);
    await sleep(2000);
  }
  fail(
    `Finder could not lay out the disk image: ${error}\nAllow this terminal to control Finder in System Settings → Privacy & Security → Automation, keep the screen unlocked, then build again.`,
  );
}

/** The final image must hold the app, signed as before, the Applications link and the layout. */
function check(mount: string): void {
  const app = join(mount, APP_NAME);
  if (!existsSync(app)) fail(`the styled image has no ${APP_NAME}`);
  const link = join(mount, APPLICATIONS_NAME);
  if (!lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink() || readlinkSync(link) !== "/Applications") fail("the styled image has no Applications link");
  for (const file of [join(BACKGROUND_DIR, BACKGROUND_FILE), ".DS_Store", ".VolumeIcon.icns"]) {
    if (!existsSync(join(mount, file))) fail(`the styled image has no ${file}`);
  }
  run(["codesign", "--verify", "--deep", "--strict", app], `codesign --verify of the app in the styled image`);
}

async function style(dmg: string, work: string): Promise<void> {
  // The background is found through the volume's name: a mounted Spec Control would make ours `Spec Control 1`.
  if (existsSync(MOUNT_POINT)) fail(`${MOUNT_POINT} is mounted, probably an image you opened; eject it and build again`);

  const format = /^Format: (\S+)$/m.exec(run(["hdiutil", "imageinfo", dmg]))?.[1] ?? fail(`cannot read the format of ${dmg}`);

  const stage = join(work, "stage");
  await mkdir(join(stage, BACKGROUND_DIR), { recursive: true });
  const original = attach(dmg, ["-readonly", "-nobrowse", "-mountpoint", join(work, "original")]);
  if (!existsSync(join(original.mount, APP_NAME))) fail(`${dmg} holds no ${APP_NAME}`);
  run(["ditto", join(original.mount, APP_NAME), join(stage, APP_NAME)]);
  await detach(original.device);
  await symlink("/Applications", join(stage, APPLICATIONS_NAME));
  await drawBackground(work, join(stage, BACKGROUND_DIR, BACKGROUND_FILE));

  // HFS+, with room for Finder's files and the volume icon beside the app.
  const megabytes = Number.parseInt(run(["du", "-sm", stage]), 10) + 20;
  const writable = join(work, "writable.dmg");
  run(["hdiutil", "create", "-volname", VOLUME_NAME, "-srcfolder", stage, "-fs", "HFS+", "-format", "UDRW", "-size", `${megabytes}m`, writable]);

  const volume = attach(writable, ["-readwrite", "-noverify"]);
  if (volume.mount !== MOUNT_POINT) fail(`the image mounted at ${volume.mount}, not ${MOUNT_POINT}`);
  await layOut(volume.mount);
  // After Finder is done with the window: it removes a `.VolumeIcon.icns` that is there while it lays out.
  await copyFile(join(volume.mount, APP_NAME, "Contents", "Resources", "AppIcon.icns"), join(volume.mount, ".VolumeIcon.icns"));
  // Finder's custom-icon flag (0x0400) on the volume's root.
  run(["xattr", "-wx", "com.apple.FinderInfo", `${"0".repeat(16)}0400${"0".repeat(44)}`, volume.mount]);
  run(["sync"]);
  await detach(volume.device);

  const converted = join(work, "styled.dmg");
  run(["hdiutil", "convert", writable, "-format", format, "-o", converted]);
  const result = attach(converted, ["-readonly", "-nobrowse", "-mountpoint", join(work, "check")]);
  check(result.mount);
  await detach(result.device);

  // Next to the original first, so the replacement is one rename on the same volume.
  const next = `${dmg}.styled`;
  await copyFile(converted, next);
  await rename(next, dmg);
}

if (process.env.ELECTROBUN_DEVELOPER_ID) {
  console.log("style-dmg: Developer ID build, keeping Electrobun's signed disk image");
  process.exit(0);
}
if (process.platform !== "darwin" || (process.env.ELECTROBUN_OS && process.env.ELECTROBUN_OS !== "macos")) process.exit(0);

const dir = process.env.ELECTROBUN_ARTIFACT_DIR;
if (!dir) {
  console.error("style-dmg: ELECTROBUN_ARTIFACT_DIR is not set");
  process.exit(1);
}
const images = (await readdir(dir)).filter((name) => name.endsWith(".dmg"));
if (images.length !== 1) {
  console.error(`style-dmg: expected exactly one .dmg in ${dir}, found ${images.length}`);
  process.exit(1);
}
const dmg = join(dir, images[0] as string);
const work = await mkdtemp(join(tmpdir(), "spec-control-dmg-"));
try {
  await style(dmg, work);
  console.log(`style-dmg: styled ${dmg}`);
} catch (error) {
  console.error(`style-dmg: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  for (const device of [...attached].reverse()) await detach(device);
  await rm(work, { recursive: true, force: true });
}

// Ad-hoc signs the app when no Developer ID is configured (openspec/changes/unsigned-macos-app, design D1). Run as the
// `postBuild` hook, on the real app before Electrobun compresses it into the wrapper's payload, and as the `postWrap`
// hook, on the self-extracting wrapper that goes into the disk image. Apple silicon runs no unsigned code; an ad-hoc
// signature needs no certificate. With `ELECTROBUN_DEVELOPER_ID` set, Electrobun signs and notarises instead.
import { readdirSync } from "node:fs";
import { join } from "node:path";

function fail(message: string): never {
  console.error(`adhoc-sign: ${message}`);
  process.exit(1);
}

/** The `.app` bundles directly in `dir` or one level below it. */
function appsUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    if (entry.name.endsWith(".app")) found.push(path);
    else for (const inner of readdirSync(path, { withFileTypes: true })) if (inner.isDirectory() && inner.name.endsWith(".app")) found.push(join(path, inner.name));
  }
  return found;
}

if (process.env.ELECTROBUN_DEVELOPER_ID) process.exit(0);
if (process.env.ELECTROBUN_OS && process.env.ELECTROBUN_OS !== "macos") process.exit(0);

const wrapper = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
const buildDir = process.env.ELECTROBUN_BUILD_DIR;
const bundles = wrapper ? [wrapper] : buildDir ? appsUnder(buildDir) : fail("neither ELECTROBUN_WRAPPER_BUNDLE_PATH nor ELECTROBUN_BUILD_DIR is set");
if (bundles.length === 0) fail(`no .app bundle under ${buildDir}`);

for (const bundle of bundles) {
  const sign = Bun.spawnSync(["codesign", "--force", "--deep", "--sign", "-", bundle], { stdout: "inherit", stderr: "inherit" });
  if (sign.exitCode !== 0) fail(`codesign failed for ${bundle}`);
  const verify = Bun.spawnSync(["codesign", "--verify", "--deep", "--strict", bundle], { stdout: "inherit", stderr: "inherit" });
  if (verify.exitCode !== 0) fail(`the ad-hoc signature of ${bundle} does not verify`);
  console.log(`adhoc-sign: signed ${bundle}`);
}

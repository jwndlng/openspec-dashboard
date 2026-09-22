// Compiles the server (with the UI built beforehand into dist/ui/index.html) into the single binary
// dist/openspec-dashboard. The version it reports comes from OPENSPEC_DASHBOARD_VERSION, set by the release workflow;
// every other build is `dev` (src/server/version.ts).
import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const version = process.env.OPENSPEC_DASHBOARD_VERSION || "dev";

const build = Bun.spawn(
  [
    "bun",
    "build",
    "--compile",
    "src/server/index.ts",
    "--outfile",
    "dist/openspec-dashboard",
    "--define",
    `OPENSPEC_DASHBOARD_BUILD_VERSION=${JSON.stringify(version)}`,
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
const code = await build.exited;

// `bun build --compile` leaves temporary `.*.bun-build` files in the working directory.
for (const file of new Bun.Glob(".*.bun-build").scanSync({ cwd: root, dot: true })) await rm(join(root, file), { force: true });

process.exit(code);

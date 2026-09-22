// The version this binary was built as: the release tag in a release build (`scripts/build.ts` passes
// `OPENSPEC_DASHBOARD_VERSION` through `--define`), `dev` in every other build and under `bun run`.
declare const OPENSPEC_DASHBOARD_BUILD_VERSION: string | undefined;

// Read behind `typeof`: without the define the global does not exist, and reading it directly would throw.
export const VERSION: string = typeof OPENSPEC_DASHBOARD_BUILD_VERSION === "string" ? OPENSPEC_DASHBOARD_BUILD_VERSION : "dev";

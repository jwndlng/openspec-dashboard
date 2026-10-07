// The version this binary was built as: the release tag in a release build (`scripts/build.ts` passes
// `SPEC_CONTROL_VERSION` through `--define`), `dev` in every other build and under `bun run`.
declare const SPEC_CONTROL_BUILD_VERSION: string | undefined;

// Read behind `typeof`: without the define the global does not exist, and reading it directly would throw.
export const VERSION: string = typeof SPEC_CONTROL_BUILD_VERSION === "string" ? SPEC_CONTROL_BUILD_VERSION : "dev";

// Release versions (openspec/specs/update-notice, "Versions are compared numerically"): `v<major>.<minor>.<patch>`,
// the form release tags take. Shared because the server decides whether to check and the UI explains why it does not.
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

function releaseParts(version: string): number[] | undefined {
  const match = RELEASE_TAG.exec(version);
  return match ? match.slice(1).map(Number) : undefined;
}

/** Whether `version` is a release tag; a build of any other version (`dev`, the demo's) never checks. */
export function isReleaseVersion(version: string): boolean {
  return releaseParts(version) !== undefined;
}

/** True when both are release versions and `latest` is greater, comparing major, minor and patch as numbers. */
export function isNewer(latest: string, current: string): boolean {
  const a = releaseParts(latest);
  const b = releaseParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

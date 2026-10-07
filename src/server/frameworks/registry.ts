// Which framework module reads a folder (spec-frameworks spec; support-spec-frameworks design D2, D5). The order is
// fixed: the first module that claims a folder reads it, so a folder with the markers of two is read once.
import { DEFAULT_FRAMEWORK, type FrameworkId } from "../../shared/types.ts";
import type { RepoSource } from "../source.ts";
import type { FrameworkLayout, SpecFramework } from "./framework.ts";
import { openSpec } from "./openspec/index.ts";

/** The registered modules, in the order they are asked. */
export const FRAMEWORKS: readonly SpecFramework[] = [openSpec];

/**
 * Modules whose change paths the dashboard-api "never writes" requirement enumerates. Only these are offered the writes
 * that depend on a framework (creating and dismissing a change); a module registered without its paths being specified
 * there stays read-only by construction.
 */
const WRITABLE: ReadonlySet<FrameworkId> = new Set(["openspec"]);

export function frameworkById(id: FrameworkId | undefined, frameworks: readonly SpecFramework[] = FRAMEWORKS): SpecFramework | undefined {
  return frameworks.find((f) => f.id === (id ?? DEFAULT_FRAMEWORK));
}

/** Discovery: the first module whose project marker `dir` has. */
export async function detectFramework(dir: string, frameworks: readonly SpecFramework[] = FRAMEWORKS): Promise<SpecFramework | undefined> {
  for (const framework of frameworks) if (await framework.isProject(dir)) return framework;
  return undefined;
}

/** Scan: the first module that claims the tracked folder `source` reads. Rejects when the source does. */
export async function claimFramework(source: RepoSource, frameworks: readonly SpecFramework[] = FRAMEWORKS): Promise<SpecFramework | undefined> {
  for (const framework of frameworks) if (await framework.claims(source)) return framework;
  return undefined;
}

/** The scan error of a tracked folder no module claims. */
export function unclaimedMessage(frameworks: readonly SpecFramework[] = FRAMEWORKS): string {
  if (frameworks.length === 1) return frameworks[0].missingMessage();
  return `repository path or its ${frameworks.map((f) => `${f.layout.root}/`).join(" or ")} directory does not exist`;
}

/** Every directory name some module's own tree uses: discovery does not descend into them. */
export function skippedDirs(frameworks: readonly SpecFramework[] = FRAMEWORKS): Set<string> {
  return new Set(frameworks.flatMap((f) => f.layout.skipDirs));
}

/** The layout a writer may use for `framework`, or undefined when that module's write paths are not enumerated. */
export function writablePaths(framework: SpecFramework | undefined): FrameworkLayout | undefined {
  return framework && WRITABLE.has(framework.id) ? framework.layout : undefined;
}

/**
 * The OpenSpec layout, for the writers whose paths the "never writes" requirement names literally — pull leftovers,
 * the session worktree copy and the docs-only check. Pinned rather than derived: another module's files never match it.
 */
export const OPENSPEC_PATHS: FrameworkLayout = openSpec.layout;

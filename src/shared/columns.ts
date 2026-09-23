// Column derivation. Pure functions shared by server and UI.
import { STAGE_COLUMN, type ArtifactStatus, type Snapshot, type Stage, type TaskProgress } from "./types.ts";

export const UNKNOWN_COLUMN = STAGE_COLUMN.unknown;

/** `Done`: every task is ticked and the change is not archived yet, whether or not its specs are synced. */
export function isComplete(stage: Stage): boolean {
  return stage === "done";
}

export interface StageInput {
  archived: boolean;
  artifacts: ArtifactStatus[];
  tasks: TaskProgress | null;
}

/**
 * The lifecycle phase of a change: Backlog → Drafts → Ready → Implementing → Done → Archived. Which artifacts are
 * written, and in which order, does not matter — only how many of them.
 */
export function deriveStage(input: StageInput): { stage: Stage; column: string } {
  const at = (stage: Stage) => ({ stage, column: STAGE_COLUMN[stage] });
  if (input.archived) return at("archived");
  const { tasks, artifacts } = input;
  if (tasks && tasks.total > 0 && tasks.done === tasks.total) return at("done");
  if (tasks && tasks.done > 0) return at("implementing");
  if (artifacts.length === 0) return at("unknown");
  const done = artifacts.filter((a) => a.status === "done").length;
  // Fully planned but nothing ticked yet: ready to apply, not in progress.
  if (done === artifacts.length) return at("ready");
  return at(done === 0 ? "backlog" : "drafts");
}

/** Board column order: every lifecycle column, with `Unknown` only when a change on this board is in it. */
export function boardColumns(snapshot: Snapshot): string[] {
  const hasUnknown = snapshot.repos.some((r) => r.changes.some((c) => c.column === UNKNOWN_COLUMN));
  return Object.values(STAGE_COLUMN).filter((column) => column !== UNKNOWN_COLUMN || hasUnknown);
}

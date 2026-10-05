// Column derivation. Pure functions shared by server and UI.
import { STAGE_COLUMN, type ArtifactStatus, type DoneSubState, type Snapshot, type Stage, type TaskProgress } from "./types.ts";

export const UNKNOWN_COLUMN = STAGE_COLUMN.unknown;

/** `Done`: every task is settled — ticked or awaiting validation — and the change is not archived yet, whether or not its specs are synced. */
export function isComplete(stage: Stage): boolean {
  return stage === "done";
}

export interface StageInput {
  archived: boolean;
  artifacts: ArtifactStatus[];
  tasks: TaskProgress | null;
}

/**
 * The artifacts a change needs before it can be implemented: those its schema's `apply.requires` names. Every artifact
 * when none carries the flag — a snapshot recorded before it was reported — or when none is required, so a change is
 * never ready with nothing written.
 */
export function requiredArtifacts(artifacts: ArtifactStatus[]): ArtifactStatus[] {
  if (!artifacts.some((a) => a.required !== undefined)) return artifacts;
  const required = artifacts.filter((a) => a.required);
  return required.length ? required : artifacts;
}

/** Every artifact needed before implementing is written (`requiredArtifacts`); false for a change without artifacts. */
export function isPlanned(artifacts: ArtifactStatus[]): boolean {
  return artifacts.length > 0 && requiredArtifacts(artifacts).every((a) => a.status === "done");
}

/**
 * The lifecycle phase of a change: Backlog → Drafts → Ready → Implementing → Done → Archived. A change is `Ready` once
 * every *required* artifact is written (its schema's `apply.requires`; for spec-driven only `tasks`, so a design is
 * optional); otherwise only how many artifacts are written matters, not which. A task is *settled* once it is ticked or
 * awaiting validation: both mean the agent is finished with it, so both carry the change towards `Done`. Only `done`
 * has a sub-state, `validate` while a person still has to confirm at least one task.
 */
export function deriveStage(input: StageInput): { stage: Stage; column: string; subState?: DoneSubState } {
  const at = (stage: Stage, subState?: DoneSubState) => ({ stage, column: STAGE_COLUMN[stage], ...(subState ? { subState } : {}) });
  if (input.archived) return at("archived");
  const { tasks, artifacts } = input;
  const settled = tasks ? tasks.done + (tasks.awaiting ?? 0) : 0;
  if (tasks && tasks.total > 0 && settled === tasks.total) return at("done", tasks.awaiting ? "validate" : "complete");
  if (tasks && settled > 0) return at("implementing");
  if (artifacts.length === 0) return at("unknown");
  // Planned but nothing ticked yet: ready to apply, not in progress.
  if (isPlanned(artifacts)) return at("ready");
  return at(artifacts.some((a) => a.status === "done") ? "drafts" : "backlog");
}

/** Board column order: every lifecycle column, with `Unknown` only when a change on this board is in it. */
export function boardColumns(snapshot: Snapshot): string[] {
  const hasUnknown = snapshot.repos.some((r) => r.changes.some((c) => c.column === UNKNOWN_COLUMN));
  return Object.values(STAGE_COLUMN).filter((column) => column !== UNKNOWN_COLUMN || hasUnknown);
}

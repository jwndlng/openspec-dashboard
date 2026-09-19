// Column derivation. Pure functions shared by server and UI.
import { IMPLEMENTATION_COLUMNS, type ArtifactStatus, type Snapshot, type Stage, type TaskProgress } from "./types.ts";

export const UNKNOWN_COLUMN = "Unknown";

export function artifactLabel(id: string): string {
  return id
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const NEW_COLUMN = "New";

/**
 * Column order of a schema's artifacts where it differs from the schema's own order. `spec-driven` lists specs before
 * design, but design is written first. Schemas not listed here are shown in their own order.
 */
const DISPLAY_ORDER: Record<string, string[]> = { "spec-driven": ["proposal", "design", "specs", "tasks"] };

/** Artifacts in display order: ids the override names first (in its order), the rest after them in schema order. */
export function displayOrder<T extends { id: string }>(schema: string, artifacts: T[]): T[] {
  const order = DISPLAY_ORDER[schema];
  if (!order) return artifacts;
  const rank = (a: T) => (order.includes(a.id) ? order.indexOf(a.id) : order.length);
  return artifacts.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map(({ a }) => a);
}

/** `Done` and `Synced` both mean every task is ticked and the change is not archived yet. */
export function isComplete(stage: Stage): boolean {
  return stage === "done" || stage === "synced";
}

export interface StageInput {
  archived: boolean;
  schema: string;
  artifacts: ArtifactStatus[];
  tasks: TaskProgress | null;
  /** Delta specs already merged into the main specs; only looked at once every task is ticked. */
  specsSynced?: boolean;
}

/** A column names the last step that is complete: New → artifacts… → Ready → Implementing → Done → Synced → Archived. */
export function deriveStage(input: StageInput): { stage: Stage; column: string } {
  if (input.archived) return { stage: "archived", column: "Archived" };
  const { tasks, artifacts } = input;
  if (tasks && tasks.total > 0 && tasks.done === tasks.total) {
    return input.specsSynced ? { stage: "synced", column: "Synced" } : { stage: "done", column: "Done" };
  }
  if (tasks && tasks.done > 0) return { stage: "implementing", column: "Implementing" };
  if (artifacts.length === 0) return { stage: "artifact", column: UNKNOWN_COLUMN };
  // The longest leading run of finished artifacts: a change is at step N only once steps 1…N are all written.
  const ordered = displayOrder(input.schema, artifacts);
  const firstOpen = ordered.findIndex((a) => a.status !== "done");
  // Fully planned but nothing ticked yet: ready to apply, not in progress.
  if (firstOpen === -1) return { stage: "ready", column: "Ready" };
  if (firstOpen === 0) return { stage: "new", column: NEW_COLUMN };
  return { stage: "artifact", column: artifactLabel(ordered[firstOpen - 1].id) };
}

/**
 * Board column order: New, the artifact columns of the most common schema, then any artifact columns other schemas
 * introduce (in their order), then the implementation columns. A schema's last artifact has no column: once it is
 * written every artifact is done, which is Ready.
 */
export function boardColumns(snapshot: Snapshot): string[] {
  const orderBySchema = new Map<string, string[]>();
  const countBySchema = new Map<string, number>();
  for (const repo of snapshot.repos) {
    for (const change of repo.changes) {
      if (change.artifacts.length === 0) continue;
      countBySchema.set(change.schema, (countBySchema.get(change.schema) ?? 0) + 1);
      if (!orderBySchema.has(change.schema)) {
        const labels = displayOrder(change.schema, change.artifacts).map((a) => artifactLabel(a.id));
        orderBySchema.set(change.schema, labels.slice(0, -1));
      }
    }
  }
  const schemas = [...countBySchema.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const columns: string[] = [];
  for (const schema of schemas) {
    for (const label of orderBySchema.get(schema) ?? []) {
      if (!columns.includes(label)) columns.push(label);
    }
  }
  const hasUnknown = snapshot.repos.some((r) => r.changes.some((c) => c.column === UNKNOWN_COLUMN));
  if (hasUnknown) columns.push(UNKNOWN_COLUMN);
  return [NEW_COLUMN, ...columns, ...IMPLEMENTATION_COLUMNS];
}

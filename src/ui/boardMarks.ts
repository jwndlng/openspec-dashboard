// What the views draw beside their data: the lifecycle marker on a column header (kanban-board: "Column headers mark
// the lifecycle stage") and the prompt as the detail view shows it. Pure, so tests can pin them without a DOM.
import { UNKNOWN_COLUMN } from "../shared/columns.ts";

export type ColumnKind = "neutral" | "accent" | "success" | "muted" | "warning";

const LIFECYCLE_KIND: Record<string, ColumnKind> = {
  Ready: "accent",
  Implementing: "accent",
  Done: "success",
  Archived: "muted",
  [UNKNOWN_COLUMN]: "warning",
};

/** The marker colour of a column: `Backlog` and `Drafts` are neutral. */
export function columnKind(label: string): ColumnKind {
  return LIFECYCLE_KIND[label] ?? "neutral";
}

/**
 * The text of a change's `prompt.md` as the detail view shows it: without the heading the create form writes above it
 * (`# Prompt`) and without surrounding blank lines. Plain text; undefined when nothing is left.
 */
export function promptBody(prompt: string | undefined): string | undefined {
  const lines = (prompt ?? "").split(/\r?\n/);
  while (lines.length && (lines[0].trim() === "" || lines[0].trim().startsWith("#"))) lines.shift();
  const text = lines.join("\n").trim();
  return text || undefined;
}

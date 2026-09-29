import type { TaskProgress } from "../shared/types.ts";

// A task line is a CommonMark list item (`-`, `*`, `+`, `1.`, `1)`) followed by a checkbox holding at most one
// character, with any spacing around it. Mirrors what `openspec` counts for progress, plus this project's `[~]`.
const TASK_LINE = /^\s*(?:[-*+]|\d+[.)])\s+\[\s*([^\]\s]?)\s*\]/;

/**
 * Counts the three checkbox states: done (`[x]`), awaiting a person's confirmation (`[~]`) and open (everything else).
 * A marker this does not recognise counts as open — never as done, the rule OpenSpec's archive workflow follows too.
 */
export function parseTaskProgress(markdown: string): TaskProgress {
  let done = 0;
  let awaiting = 0;
  let total = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const match = TASK_LINE.exec(line);
    if (!match) continue;
    total += 1;
    const state = match[1];
    if (state === "x" || state === "X") done += 1;
    else if (state === "~") awaiting += 1;
  }
  return { done, awaiting, total };
}

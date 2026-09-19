import type { TaskProgress } from "../shared/types.ts";

// A task line is a CommonMark list item (`-`, `*`, `+`, `1.`, `1)`) followed by
// a checkbox. Mirrors what `openspec` counts for progress.
const TASK_LINE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/;

export function parseTaskProgress(markdown: string): TaskProgress {
  let done = 0;
  let total = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const match = TASK_LINE.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] !== " ") done += 1;
  }
  return { done, total };
}

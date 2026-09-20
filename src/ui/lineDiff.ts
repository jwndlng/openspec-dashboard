// Minimal line diff (longest common subsequence) for the shared-config preview. Config files are tiny, so the
// quadratic table is fine and no dependency is needed.
export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: a[i++] });
    } else {
      out.push({ kind: "add", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: "del", text: a[i++] });
  while (j < b.length) out.push({ kind: "add", text: b[j++] });
  return out;
}

export type DiffHunk = { kind: "lines"; lines: DiffLine[] } | { kind: "skipped"; count: number };

/** Keeps `context` unchanged lines around every change and folds the rest, so a one-line edit reads as one. */
export function foldDiff(lines: DiffLine[], context = 2): DiffHunk[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const hunks: DiffHunk[] = [];
  for (let i = 0; i < lines.length; ) {
    let j = i;
    while (j < lines.length && keep[j] === keep[i]) j++;
    hunks.push(keep[i] ? { kind: "lines", lines: lines.slice(i, j) } : { kind: "skipped", count: j - i });
    i = j;
  }
  return hunks;
}

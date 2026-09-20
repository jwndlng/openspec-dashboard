const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function daysSince(iso: string | undefined, now = Date.now()): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : Math.floor((now - t) / DAY);
}

/** "just now", "5m", "3h", "12d" — compact, for card footers. */
export function relTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const days = Math.floor(diff / DAY);
  return days < 60 ? `${days}d` : `${Math.floor(days / 30)}mo`;
}

const BRANCH_SEPARATORS = "-/_.";

/**
 * Splits a branch name for the two-part badge: `head` may be clipped with an ellipsis, `tail` is always
 * shown, so the distinguishing end of a long name stays readable. Short names are not split. The tail
 * starts at a word boundary when one is at most `nudge` characters further left.
 */
export function splitBranchLabel(name: string, tailLength = 16, nudge = 4): { head: string; tail: string } {
  if (name.length <= tailLength + nudge) return { head: name, tail: "" };
  let start = name.length - tailLength;
  if (BRANCH_SEPARATORS.includes(name[start])) {
    start += 1; // the cut landed on a separator: it belongs to the head
  } else {
    for (let i = start; i >= start - nudge && i > 0; i--) {
      if (BRANCH_SEPARATORS.includes(name[i - 1])) {
        start = i;
        break;
      }
    }
  }
  return { head: name.slice(0, start), tail: name.slice(start) };
}

export function applyCommand(repoPath: string, changeName: string): string {
  return `cd ${shellQuote(repoPath)} && claude "/opsx:apply ${changeName}"`;
}

export function cdCommand(repoPath: string): string {
  return `cd ${shellQuote(repoPath)}`;
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./~-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

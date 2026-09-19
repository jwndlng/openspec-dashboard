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

export function applyCommand(repoPath: string, changeName: string): string {
  return `cd ${shellQuote(repoPath)} && claude "/opsx:apply ${changeName}"`;
}

export function cdCommand(repoPath: string): string {
  return `cd ${shellQuote(repoPath)}`;
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./~-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

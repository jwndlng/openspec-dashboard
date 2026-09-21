// Submitting text to an agent's terminal on the user's behalf (design: submit-agent-input D1/D2).
//
// Type the text, wait until the terminal shows it back, then press Enter as a separate write. A text prompt shows
// typed characters; a selection menu does not — there Enter would confirm whatever is highlighted, so it is never
// pressed blind. A separate Enter is also what makes long text submit: written in one burst with the text, the
// carriage return is taken as part of a paste.
//
// This is the only place where the dashboard looks at an agent's output, and only to answer one question: did the
// text we just typed appear? Nothing observed here is stored, logged or forwarded.

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
// OSC … (BEL | ESC \), CSI … final byte, and two-character escapes. Built from strings: no control characters in source.
const ANSI = new RegExp(`${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)|${ESC}\\[[0-?]*[ -/]*[@-~]|${ESC}[@-Z\\\\-_]`, "g");

export const PROBE_LENGTH = 48;
/** Share of the probe that must be found, in order, inside one window. */
const REQUIRED_SHARE = 0.85;
/** A window may be this much longer than the probe (room for a few foreign characters). */
const WINDOW_SLACK = 1.25;
/** Only the most recent output is searched; an echo is recent by definition. */
const SEARCH_LIMIT = 4096;

export function stripAnsi(output: string): string {
  return output.replace(ANSI, "");
}

/** Terminal UIs wrap, pad and position text freely, so whitespace carries no information about what was typed. */
export function normalise(text: string): string {
  return stripAnsi(text).replace(/\s+/g, "");
}

/** What has to show up: the whole text when short, otherwise its beginning (long input may be truncated or scrolled). */
export function echoProbe(text: string): string {
  return normalise(text).slice(0, PROBE_LENGTH);
}

function lcsLength(a: string, b: string): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Whether `output` (raw terminal output since the text was written) shows `text`. Tolerant on purpose: terminal UIs
 * redraw only the cells that changed, so with text already in the input box an echo arrives with holes. The match
 * must still sit inside one narrow window, which keeps it far from "these letters occur somewhere".
 */
export function containsEcho(output: string, text: string): boolean {
  const probe = echoProbe(text);
  if (probe.length === 0) return false;
  const haystack = normalise(output).slice(-SEARCH_LIMIT);
  if (haystack.includes(probe)) return true;
  const required = Math.ceil(probe.length * REQUIRED_SHARE);
  if (haystack.length < required) return false;
  const windowLength = Math.ceil(probe.length * WINDOW_SLACK);
  const first = probe[0];
  const second = probe[1];
  for (let start = 0; start + required <= haystack.length; start++) {
    // A window worth checking starts at (or right after a dropped) first character of the probe.
    if (haystack[start] !== first && haystack[start] !== second) continue;
    if (lcsLength(probe, haystack.slice(start, start + windowLength)) >= required) return true;
  }
  return false;
}

/** The little a submission needs from a terminal. `onOutput` returns its unsubscribe function. */
export interface SubmitTerminal {
  write(data: string): void;
  onOutput(listener: (chunk: Uint8Array) => void): () => void;
}

export interface SubmitOptions {
  /** How long to wait for the text to show up before giving up. */
  echoTimeoutMs?: number;
  /** Pause between the echo and Enter, so the agent has finished taking in the text. */
  settleMs?: number;
}

export const ECHO_TIMEOUT_MS = 2000;
export const SETTLE_MS = 400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Types `text`; presses Enter only once the terminal has shown it. Resolves `submitted: false` when it never showed
 * up — nothing further is written then, the text is simply left as typed.
 */
export async function submitText(terminal: SubmitTerminal, text: string, options: SubmitOptions = {}): Promise<{ submitted: boolean }> {
  const decoder = new TextDecoder();
  let seen = "";
  let matched: (() => void) | undefined;
  const unsubscribe = terminal.onOutput((chunk) => {
    if (chunk.length === 0) return;
    seen = (seen + decoder.decode(chunk, { stream: true })).slice(-4 * SEARCH_LIMIT);
    if (matched && containsEcho(seen, text)) matched();
  });
  try {
    const echoed = new Promise<boolean>((resolve) => {
      matched = () => resolve(true);
      setTimeout(() => resolve(false), options.echoTimeoutMs ?? ECHO_TIMEOUT_MS);
    });
    terminal.write(text);
    if (!(await echoed)) return { submitted: false };
    await sleep(options.settleMs ?? SETTLE_MS);
    terminal.write("\r");
    return { submitted: true };
  } finally {
    matched = undefined;
    unsubscribe();
  }
}

/** Text the dashboard is willing to submit: sentences, not key sequences. */
export function validSubmission(text: unknown): text is string {
  if (typeof text !== "string" || text.length === 0 || text.length > 4096) return false;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  return normalise(text).length > 0;
}

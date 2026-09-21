import { expect, test } from "bun:test";
import type { WorkStatus } from "../src/shared/types.ts";
import { type Clock, type Position, playTranscript, positionAfter, RECORDING_NOTICE, type Step, TRANSCRIPTS, workAfter } from "../src/ui/demo/transcripts.ts";

/** A clock the test advances by hand, so playback is deterministic and instant. */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    setTimeout: (fn, ms) => {
      timers.set(++seq, { at: now + ms, fn });
      return seq;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = until;
  };
  return { clock, advance, pending: () => timers.size };
}

const VALUES = { change: "add-rate-limiting", branch: "feat/add-rate-limiting", path: "/home/demo/code/atlas-api-worktrees/feat-add-rate-limiting" };
const STEPS: Step[] = [
  { out: "one {change}\r\n" },
  { out: "two\r\n", after: 1000, work: { state: "uncommitted", count: 1 } },
  { ask: "ok? ", after: 1000 },
  { out: "three {branch}\r\n", after: 500, work: { state: "uncommitted", count: 2 } },
  { exit: 0, after: 500 },
];

function play(from: Position, steps = STEPS) {
  const t = fakeClock();
  const events: string[] = [];
  const progress: [Position, WorkStatus | undefined][] = [];
  const decoder = new TextDecoder();
  const playback = playTranscript(steps, {
    from,
    values: VALUES,
    clock: t.clock,
    onProgress: (p, w) => progress.push([p, w]),
    handlers: { onOpen: () => events.push("<open>"), onData: (b) => events.push(decoder.decode(b)), onExit: () => events.push("<exit>"), onSubmitted: (ok) => events.push(`<submitted:${ok}>`), onClose: () => events.push("<close>") },
  });
  return { ...t, events, progress, playback, text: () => events.filter((e) => !e.startsWith("<")).join("") };
}

test("positionAfter: elapsed time, never past a question; workAfter follows the milestones", () => {
  expect(positionAfter(STEPS, 0)).toEqual({ index: 1, waiting: false });
  expect(positionAfter(STEPS, 999)).toEqual({ index: 1, waiting: false });
  expect(positionAfter(STEPS, 1000)).toEqual({ index: 2, waiting: false });
  expect(positionAfter(STEPS, 2000)).toEqual({ index: 2, waiting: true });
  expect(positionAfter(STEPS, 9_999_999)).toEqual({ index: 2, waiting: true });
  expect(positionAfter([{ out: "a" }, { exit: 0, after: 10 }], 10)).toEqual({ index: 2, waiting: false });
  expect([workAfter(STEPS, 0), workAfter(STEPS, 2), workAfter(STEPS, 4)]).toEqual([undefined, { state: "uncommitted", count: 1 }, { state: "uncommitted", count: 2 }]);
  expect(workAfter(STEPS, 0, { state: "clean" })).toEqual({ state: "clean" });
});

test("from the start: labelled as a recording, paced, placeholders filled, stops at the question", () => {
  const p = play({ index: 0, waiting: false });
  expect(p.events).toEqual([]); // nothing happens synchronously
  p.advance(0);
  expect(p.events[0]).toBe("<open>");
  expect(p.events[1]).toBe(RECORDING_NOTICE);
  expect(p.text()).toContain("one add-rate-limiting");
  expect(p.text()).not.toContain("two");
  p.advance(1000);
  expect(p.text()).toContain("two");
  p.advance(60_000);
  expect(p.text().endsWith("ok? ")).toBe(true);
  expect(p.progress.at(-1)).toEqual([{ index: 2, waiting: true }, { state: "uncommitted", count: 1 }]);
  expect(p.pending()).toBe(0); // waiting costs no timer
});

test("a line of input answers the question — typed, or sent by a quick-reply button; other input is only echoed", () => {
  for (const answer of ["\r", "y\r", "yes\n"]) {
    const p = play({ index: 0, waiting: false });
    p.advance(60_000);
    p.playback.send({ type: "input", data: "y" }); // no newline yet
    p.playback.send({ type: "resize", cols: 80, rows: 24 });
    expect(p.text().endsWith("ok? y")).toBe(true);
    p.advance(60_000);
    expect(p.text()).not.toContain("three");
    p.playback.send({ type: "input", data: answer });
    p.advance(499);
    expect(p.text()).not.toContain("three");
    p.advance(1);
    expect(p.text()).toContain("three feat/add-rate-limiting");
    p.advance(500);
    expect(p.events.slice(-2)).toEqual(["<exit>", "<close>"]);
    expect(p.progress.at(-1)).toEqual([{ index: STEPS.length, waiting: false }, { state: "uncommitted", count: 2 }]);
    expect(p.pending()).toBe(0);
  }
});

test("a default response arrives as `submit`: it is typed, sent with Enter, and answered as submitted", () => {
  const p = play({ index: 0, waiting: false });
  p.advance(60_000);
  p.playback.send({ type: "submit", data: "Yes, go ahead" });
  expect(p.text().endsWith("ok? Yes, go ahead\r\n")).toBe(true);
  expect(p.events.at(-1)).toBe("<submitted:true>");
  p.advance(500);
  expect(p.text()).toContain("three feat/add-rate-limiting");
});

test("reopening: what already happened is scrollback at once, then playback continues; a pending question is asked again", () => {
  const running = play({ index: 2, waiting: false });
  running.advance(0);
  expect(running.text()).toBe(`${RECORDING_NOTICE}one add-rate-limiting\r\ntwo\r\n`);
  running.advance(1000);
  expect(running.text().endsWith("ok? ")).toBe(true);

  const waiting = play({ index: 2, waiting: true });
  waiting.advance(0);
  expect(waiting.text()).toBe(`${RECORDING_NOTICE}one add-rate-limiting\r\ntwo\r\nok? `);
  expect(waiting.pending()).toBe(0);
  waiting.playback.send({ type: "input", data: "\r" });
  waiting.advance(500);
  expect(waiting.text()).toContain("three");

  const ended = play({ index: STEPS.length, waiting: false });
  ended.advance(60_000);
  expect(ended.text()).toContain("three");
  expect(ended.events).not.toContain("<exit>"); // it already ended; reopening shows the scrollback only
});

test("closing stops playback and leaves no timers; typed text can be injected", () => {
  const p = play({ index: 0, waiting: false });
  p.advance(500);
  p.playback.type("/opsx:apply add-rate-limiting");
  expect(p.text().endsWith("/opsx:apply add-rate-limiting")).toBe(true);
  p.playback.close();
  expect(p.pending()).toBe(0);
  const before = p.events.length;
  p.advance(60_000);
  p.playback.send({ type: "input", data: "\r" });
  p.playback.type("ignored");
  expect(p.events.length).toBe(before);

  const early = play({ index: 0, waiting: false });
  early.playback.close(); // closed before it even opened
  early.advance(60_000);
  expect(early.events).toEqual([]);
});

test("every shipped transcript plays to its end, asks at most what it says, and ends by exiting", () => {
  for (const [name, steps] of Object.entries(TRANSCRIPTS)) {
    const p = play({ index: 0, waiting: false }, steps);
    for (let i = 0; i < 10 && !p.events.includes("<exit>"); i++) {
      p.advance(600_000);
      p.playback.send({ type: "input", data: "\r" });
    }
    expect([name, p.events.slice(-2)]).toEqual([name, ["<exit>", "<close>"]]);
    expect([name, /\{(change|branch|path)\}/.test(p.text())]).toEqual([name, false]);
    expect([name, steps.at(-1) && "exit" in (steps.at(-1) as Step)]).toEqual([name, true]);
  }
  expect(workAfter(TRANSCRIPTS.ship, TRANSCRIPTS.ship.length)).toEqual({ state: "pushed" });
});
